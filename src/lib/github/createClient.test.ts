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

const client = () => createClient(token, "1.2.3");
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

  it("keeps the budget the latest GraphQL answer reports", async () => {
    const connected = client();
    expect(connected.lastBudget()).toBeUndefined();
    github.graphql("Viewer", { body: { data: { rateLimit } } });
    await settle(connected.query(viewer, {}));
    expect(connected.lastBudget()).toEqual({
      limit: 5000,
      remaining: 4990,
      resetAt: new Date("2026-09-28T11:00:00Z"),
    });
  });

  it("keeps the budget when an answer carries no rate figures", async () => {
    const connected = client();
    github.graphql("Viewer", { body: { data: {} } });
    await expect(settle(connected.query(viewer, {}))).resolves.toEqual({});
    expect(connected.lastBudget()).toBeUndefined();
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

  it("retries once after a rate limit, then names GITHUB_RATE_LIMITED", async () => {
    const limited = {
      status: 403,
      body: { message: "API rate limit exceeded" },
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(now.getTime() / 1000 + 60),
      },
    };
    github.rest("GET /rate_limit", limited, limited);
    const error = await failure(client().request("GET /rate_limit"));
    expect(github.sent).toHaveLength(2);
    expect(error).toMatchObject({
      code: "GITHUB_RATE_LIMITED",
      message:
        "GitHub is refusing requests from this account until 2026-09-28T10:01:00.000Z, because its rate limit is reached.",
      recovery: "wait for the limit to reset, then refresh",
    });
  });

  it("retries after a secondary rate limit and gives the answer", async () => {
    github.rest(
      "GET /rate_limit",
      {
        status: 403,
        body: { message: "You have exceeded a secondary rate limit" },
        headers: { "retry-after": "2" },
      },
      { body: { ok: true } },
    );
    const answer = await settle(client().request("GET /rate_limit"));
    expect(answer.data).toEqual({ ok: true });
  });

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

  it("names GITHUB_REQUEST_FAILED when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const error = await failure(client().request("GET /rate_limit"));
    expect(error).toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
      message: "docket could not get an answer from GitHub.",
    });
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
