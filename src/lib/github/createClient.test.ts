import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, rateLimit, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";

let github: ReturnType<typeof fakeGitHub>;
const now = new Date("2026-09-28T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now });
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const client = () => createClient(token, "github.com", "1.2.3");
const viewer = "query Viewer { rateLimit { limit remaining resetAt } }";
const failure = (promise: Promise<unknown>) =>
  settle(promise).then(
    () => undefined,
    (error: unknown) => error,
  );

describe("createClient", () => {
  it("sends the token and docket's User-Agent to GitHub's API", async () => {
    github.rest("GET /rate_limit", { body: {} });
    await settle(client().request("GET /rate_limit"));
    const [sent] = github.sent;
    expect(sent?.url.origin).toBe("https://api.github.com");
    expect(sent?.headers.get("authorization")).toBe(`token ${token}`);
    expect(sent?.headers.get("user-agent")).toMatch(/^docket\/1\.2\.3 /);
  });

  it("calls the API of the host it is given, and names that host when the token is refused", async () => {
    github.rest("GET /api/v3/rate_limit", { body: {} });
    github.rest("GET /api/v3/user", {
      status: 401,
      body: { message: "Bad credentials" },
    });
    const connected = createClient(token, "example.com", "1.2.3");
    await settle(connected.request("GET /rate_limit"));
    expect(github.sent.at(0)?.url.href).toBe(
      "https://example.com/api/v3/rate_limit",
    );
    const error = await failure(connected.request("GET /user"));
    expect(error).toMatchObject({
      message: "GitHub refused the token gh gave for example.com.",
    });
  });

  it("keeps the budget the latest GraphQL answer reports", async () => {
    const connected = client();
    expect(connected.lastBudgets()).toEqual({});
    github.graphql("Viewer", { body: { data: { rateLimit } } });
    await settle(connected.query(viewer, {}));
    expect(connected.lastBudgets()).toEqual({
      graphql: {
        limit: 5000,
        remaining: 4990,
        resetAt: new Date("2026-09-28T11:00:00Z"),
      },
    });
  });

  it("keeps the budget when an answer carries no rate figures", async () => {
    const connected = client();
    github.graphql("Viewer", { body: { data: {} } });
    await expect(settle(connected.query(viewer, {}))).resolves.toEqual({});
    expect(connected.lastBudgets()).toEqual({});
  });

  /** The rate headers GitHub sends with an answer counted against `resource`. */
  const rateHeaders = (resource: string, remaining: number) => ({
    "x-ratelimit-resource": resource,
    "x-ratelimit-limit": "5000",
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": String(Date.parse("2026-09-28T11:00:00Z") / 1000),
  });

  it("keeps the REST and GraphQL budgets apart, from each answer's headers", async () => {
    const connected = client();
    github.rest("GET /rate_limit", {
      body: {},
      headers: rateHeaders("core", 4000),
    });
    github.graphql("Viewer", {
      body: { data: {} },
      headers: rateHeaders("graphql", 3000),
    });
    await settle(connected.request("GET /rate_limit"));
    await settle(connected.query(viewer, {}));
    const resetAt = new Date("2026-09-28T11:00:00Z");
    expect(connected.lastBudgets()).toEqual({
      rest: { limit: 5000, remaining: 4000, resetAt },
      graphql: { limit: 5000, remaining: 3000, resetAt },
    });
  });

  it('keeps the budget a "not modified" answer and a refusal report', async () => {
    const connected = client();
    github.rest("GET /rate_limit", {
      status: 304,
      headers: { etag: 'W/"one"', ...rateHeaders("core", 4000) },
    });
    github.rest("GET /user", {
      status: 404,
      body: { message: "Not Found" },
      headers: rateHeaders("core", 3999),
    });
    await settle(connected.request("GET /rate_limit"));
    expect(connected.lastBudgets().rest?.remaining).toBe(4000);
    await failure(connected.request("GET /user"));
    expect(connected.lastBudgets().rest?.remaining).toBe(3999);
  });

  it("keeps nothing from headers of another resource, or missing a figure", async () => {
    const connected = client();
    const { "x-ratelimit-reset": _, ...partial } = rateHeaders("core", 1);
    github.rest("GET /search", { body: {}, headers: rateHeaders("search", 1) });
    github.rest("GET /user", { body: {}, headers: partial });
    await settle(connected.request("GET /search"));
    await settle(connected.request("GET /user"));
    expect(connected.lastBudgets()).toEqual({});
  });

  it("gives a 304 back as a status rather than an error", async () => {
    github.rest("GET /rate_limit", {
      status: 304,
      headers: { etag: 'W/"one"' },
    });
    const answer = await settle(client().request("GET /rate_limit"));
    expect(answer.status).toBe(304);
    expect(answer.headers.etag).toBe('W/"one"');
  });

  it("sends REST requests one at a time", async () => {
    let open = 0;
    let most = 0;
    vi.stubGlobal("fetch", async () => {
      open += 1;
      most = Math.max(most, open);
      await new Promise((resolve) => setTimeout(resolve, 100));
      open -= 1;
      return Response.json({});
    });
    const connected = client();
    await settle(
      Promise.all(
        [1, 2, 3].map((n) => connected.request(`GET /repos/o/r/issues/${n}`)),
      ),
    );
    expect(most).toBe(1);
  });

  const primary = (status: number, seconds: number) => ({
    status,
    body: { message: "API rate limit exceeded" },
    headers: {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(now.getTime() / 1000 + seconds),
    },
  });

  it.each([403, 429])(
    "retries once a request refused %i for a limit that resets within a minute, after the reset, then names GITHUB_RATE_LIMITED",
    async (status) => {
      const limited = primary(status, 30);
      github.rest("GET /rate_limit", limited, limited, limited);
      const error = await failure(client().request("GET /rate_limit"));
      const times = github.sent.map(({ at }) => at);
      expect(times).toHaveLength(2);
      expect(Number(times[1]) - now.getTime()).toBeGreaterThanOrEqual(30_000);
      expect(error).toMatchObject({
        code: "GITHUB_RATE_LIMITED",
        message:
          "GitHub is refusing requests from this account until 2026-09-28T10:00:30.000Z, because its rate limit is reached.",
        recovery:
          "wait for the limit to reset at 2026-09-28T10:00:30.000Z, then refresh",
      });
    },
  );

  it("fails at once with the reset time when the limit resets in more than a minute", async () => {
    const limited = primary(403, 3600);
    github.rest("GET /rate_limit", limited, limited);
    const error = await failure(client().request("GET /rate_limit"));
    expect(github.sent).toHaveLength(1);
    expect(Date.now() - now.getTime()).toBeLessThan(60_000);
    expect(error).toMatchObject({
      code: "GITHUB_RATE_LIMITED",
      recovery:
        "wait for the limit to reset at 2026-09-28T11:00:00.000Z, then refresh",
    });
  });

  it("retries after a secondary rate limit, no sooner than GitHub asks, and gives the answer", async () => {
    github.rest(
      "GET /rate_limit",
      {
        status: 403,
        body: { message: "You have exceeded a secondary rate limit" },
        headers: { "retry-after": "10" },
      },
      { body: { ok: true } },
    );
    const answer = await settle(client().request("GET /rate_limit"));
    expect(answer.data).toEqual({ ok: true });
    const [first, second] = github.sent.map(({ at }) => at);
    expect(Number(second) - Number(first)).toBeGreaterThanOrEqual(10_000);
  });

  it.each([403, 429])(
    "sends a request refused %i for a secondary limit twice at most, the second no sooner than GitHub asks",
    async (status) => {
      const limited = {
        status,
        body: { message: "You have exceeded a secondary rate limit" },
        headers: { "retry-after": "10" },
      };
      github.rest("GET /rate_limit", limited, limited, limited, limited);
      const error = await failure(client().request("GET /rate_limit"));
      expect(error).toMatchObject({ code: "GITHUB_RATE_LIMITED" });
      const times = github.sent.map(({ at }) => at);
      expect(times).toHaveLength(2);
      expect(Number(times[1]) - Number(times[0])).toBeGreaterThanOrEqual(
        10_000,
      );
    },
  );

  it("names GITHUB_RATE_LIMITED when GraphQL reports its limit", async () => {
    const limited = {
      body: { data: null, errors: [{ type: "RATE_LIMITED", message: "x" }] },
    };
    github.graphql("Viewer", limited, limited);
    const error = await failure(client().query(viewer, {}));
    expect(error).toMatchObject({
      code: "GITHUB_RATE_LIMITED",
      message:
        "GitHub is refusing requests from this account, because its rate limit is reached.",
    });
  });

  it("retries a server error and gives the answer", async () => {
    github.rest("GET /rate_limit", { status: 502, body: {} }, { body: {} });
    const answer = await settle(client().request("GET /rate_limit"));
    expect(answer.status).toBe(200);
  });

  it("names GITHUB_UNREACHABLE when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const error = await failure(client().request("GET /rate_limit"));
    expect(error).toMatchObject({
      code: "GITHUB_UNREACHABLE",
      message: "docket could not reach github.com: the request got no answer.",
    });
  });

  it("names GITHUB_TIMED_OUT when GitHub gives no answer within 30 seconds", async () => {
    const sent: number[] = [];
    vi.stubGlobal(
      "fetch",
      (_input: unknown, { signal }: RequestInit) =>
        new Promise((_resolve, reject) => {
          sent.push(Date.now());
          signal?.addEventListener("abort", () => reject(signal.reason));
        }),
    );
    const error = await failure(client().request("GET /rate_limit"));
    expect(error).toMatchObject({
      code: "GITHUB_TIMED_OUT",
      message: "GitHub gave no answer within 30 seconds.",
    });
    // The first request is abandoned after 30 seconds, then retried.
    expect((sent[1] ?? 0) - (sent[0] ?? 0)).toBeGreaterThanOrEqual(30_000);
  });

  it("names GH_NOT_SIGNED_IN when GitHub refuses the token", async () => {
    github.rest("GET /rate_limit", {
      status: 401,
      body: { message: "Bad credentials" },
    });
    const error = await failure(client().request("GET /rate_limit"));
    expect(error).toMatchObject({
      code: "GH_NOT_SIGNED_IN",
      message: "GitHub refused the token gh gave for github.com.",
      recovery: "run gh auth login",
    });
  });

  const missing = {
    type: "NOT_FOUND",
    path: ["repository", "pullRequest"],
    message: "Could not resolve to a PullRequest with the number of 2.",
  };
  const partial = (...errors: unknown[]) => ({
    body: { data: { rateLimit, repository: { pullRequest: null } }, errors },
  });

  it("gives the data, the node null, when allowed and GitHub only did not find a node", async () => {
    github.graphql("Viewer", partial(missing));
    const connected = client();
    const data = await settle(
      connected.query(viewer, {}, { allowMissing: true }),
    );
    expect(data).toEqual({ rateLimit, repository: { pullRequest: null } });
    expect(connected.lastBudgets().graphql?.remaining).toBe(4990);
  });

  it("names GITHUB_REQUEST_FAILED for a node GitHub did not find, unless allowed", async () => {
    github.graphql("Viewer", partial(missing));
    const error = await failure(client().query(viewer, {}));
    expect(error).toMatchObject({ code: "GITHUB_REQUEST_FAILED" });
  });

  it("names GITHUB_REQUEST_FAILED, even when allowed, for any other error or no data", async () => {
    github.graphql(
      "Viewer",
      partial(missing, { type: "FORBIDDEN", path: ["x"], message: "No." }),
      partial({ ...missing, path: undefined }),
      { body: { data: null, errors: [missing] } },
    );
    const connected = client();
    for (let n = 0; n < 3; n += 1) {
      const error = await failure(
        connected.query(viewer, {}, { allowMissing: true }),
      );
      expect(error).toMatchObject({ code: "GITHUB_REQUEST_FAILED" });
    }
  });

  it("names GITHUB_UNREACHABLE, even when allowed, when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const error = await failure(
      client().query(viewer, {}, { allowMissing: true }),
    );
    expect(error).toMatchObject({ code: "GITHUB_UNREACHABLE" });
  });

  it("names GITHUB_REQUEST_FAILED when a page of a list is refused", async () => {
    const connected = client();
    const read = async () => {
      for await (const _ of connected.pages("GET /repos/o/r/teams")) {
        // Every page is read.
      }
    };
    const errors = [
      await failure(read()),
      await failure(connected.paginate(viewer, {})),
    ];
    expect(errors).toMatchObject([
      { code: "GITHUB_REQUEST_FAILED" },
      { code: "GITHUB_REQUEST_FAILED" },
    ]);
  });

  it("names GITHUB_REQUEST_FAILED with the status GitHub refused with", async () => {
    const error = await failure(client().request("GET /repos/o/r"));
    expect(error).toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
      message: "GitHub refused a request with status 404.",
    });
  });

  it("names GITHUB_REQUEST_FAILED with the error a GraphQL answer carries", async () => {
    github.graphql("Viewer", {
      body: {
        data: null,
        errors: [{ type: "NOT_FOUND", message: "Could not resolve." }],
      },
    });
    const error = await failure(client().query(viewer, {}));
    expect(error).toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
      message: "GitHub answered with an error: Could not resolve.",
    });
  });

  it("never lets the token into an error or the console", async () => {
    const logged = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
    ];
    github.rest("GET /rate_limit", {
      status: 401,
      body: { message: "Bad credentials" },
    });
    github.graphql("Viewer", {
      body: { data: null, errors: [{ message: "Something failed." }] },
    });
    const connected = client();
    const errors = [
      await failure(connected.request("GET /rate_limit")),
      await failure(connected.query(viewer, {})),
      await failure(connected.request("GET /repos/o/r")),
    ];
    for (const error of errors) {
      const seen = `${JSON.stringify(error)} ${String(error)} ${(error as Error).stack} ${Object.values(error as object).join(" ")}`;
      expect(seen).not.toContain(token);
      expect((error as Error).cause).toBeUndefined();
    }
    for (const spy of logged) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(token);
    }
  });
});
