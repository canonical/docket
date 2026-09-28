import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import findFixture from "./findFixture.js";
import makeHome from "./makeHome.js";
import type { SentRequest } from "./types.js";

/**
 * One refresh of the watched repositories stays within the budget
 * proposed for GitHub's limits, and docket never has two requests open
 * at once, as GitHub asks of its clients. An open terminal pane stays
 * within it over a day: left without a key, it checks each repository at
 * most every 30 minutes once 20 minutes have passed, sends nothing else,
 * and so spends no points while nothing changes; scrolled through, it
 * reads details at most a point a request, within 300 points an hour.
 *
 * The budget, per repository, is what docket's page sizes cost: a whole
 * fetch asks for 50 threads a page and costs 8 points, a fetch of what
 * changed about 2, and the check for changes, answered "not modified",
 * nothing. A whole fetch at 100 threads a page costs twice as much and
 * took 7.2 of the 10 seconds GitHub allows a query, so a return to it
 * fails here. Each message's text and each review request's requester are
 * fields, which GitHub does not charge, so a whole fetch costs exactly 8
 * points; a list of their own, such as a separate list of each thread's
 * latest comment, costs 50 requests for each of the issues and the pull
 * requests and would take a page to 9, which fails here too. A refresh
 * sends the check and one query a page of threads;
 * the recording's lists fit one page. The reading of each repository's
 * own file, and of the login gh is signed in with, belongs to the call,
 * not to the refresh, so it is left out of the count.
 */
const budget = {
  whole: { points: 8, requests: 2 },
  changed: { points: 2, requests: 2 },
  unchanged: { points: 0, requests: 1 },
};
const repositories = 2;

/**
 * The points GitHub charges for a GraphQL request, by its published rule:
 * every connection is taken as full, at its `first` or `last`, and costs
 * one request for each node that holds it; the sum over 100, rounded, is
 * the cost, and never less than 1. A list left out by `@include` or
 * `@skip` costs nothing.
 */
function countPoints({ query, variables }: Record<string, unknown>): number {
  const values = (variables ?? {}) as Record<string, unknown>;
  const tokens =
    String(query).match(/\.\.\.|\$?\w+|[{}()[\]:@!=,]|"[^"]*"/g) ?? [];
  let position = 0;
  const next = () => tokens.at(position++) ?? "";
  const peek = () => tokens.at(position) ?? "";
  const skipBalanced = (open: string, close: string) => {
    let depth = 0;
    do {
      const token = next();
      if (token === open) depth += 1;
      if (token === close) depth -= 1;
    } while (depth > 0 && position < tokens.length);
  };
  const resolve = (token: string) =>
    Number(token.startsWith("$") ? values[token.slice(1)] : token);
  /** The requests a selection set costs when `holders` nodes hold it. */
  const readSelection = (holders: number): number => {
    let requests = 0;
    next(); // {
    while (peek() !== "}" && position < tokens.length) {
      if (peek() === "...") {
        next();
        if (peek() === "on") position += 2;
        if (peek() === "{") requests += readSelection(holders);
        continue;
      }
      next();
      if (peek() === ":") position += 2; // an alias, then the field
      let size: number | undefined;
      if (peek() === "(") {
        const start = position;
        skipBalanced("(", ")");
        const args = tokens.slice(start, position);
        const at = args.findIndex((t) => t === "first" || t === "last");
        if (at >= 0) size = resolve(args.at(at + 2) ?? "0");
      }
      let included = true;
      while (peek() === "@") {
        next();
        const directive = next();
        const start = position;
        skipBalanced("(", ")");
        const condition = values[String(tokens.at(position - 2)).slice(1)];
        if (tokens.at(start) === "(") {
          included &&= directive === "skip" ? !condition : Boolean(condition);
        }
      }
      if (peek() === "{") {
        const inner = readSelection(
          size === undefined ? holders : holders * size,
        );
        if (included) requests += inner + (size === undefined ? 0 : holders);
      }
    }
    next(); // }
    return requests;
  };
  while (peek() !== "{" && position < tokens.length) {
    if (peek() === "(") skipBalanced("(", ")");
    else next();
  }
  return Math.max(1, Math.round(readSelection(1) / 100));
}

/** The name of a GraphQL request's operation, such as `Snapshot`. */
const nameOperation = ({ body }: SentRequest) =>
  /^\s*query\s+(\w+)/.exec(String(body.query ?? ""))?.[1];

/** Whether a request reads a file or the viewer, for the call, not the refresh. */
const isCallRead = (request: SentRequest) =>
  ["File", "Viewer"].includes(nameOperation(request) ?? "");

/** Whether a request reads a thread's details, one or several at once. */
const isDetailRead = (request: SentRequest) =>
  ["Detail", "Details"].includes(nameOperation(request) ?? "");

/** A pane left without a key for 20 minutes is idle. */
const idleAfter = 20 * 60_000;
/** An idle pane checks each repository at most every 30 minutes. */
const idleInterval = 30 * 60_000;
/** Details may spend 300 points an hour. */
const detailBudgetPerHour = 300;
const day = 24 * 3_600_000;

/** The points and requests one refresh spent. */
const measure = (requests: readonly SentRequest[]) => {
  const refresh = requests.filter((request) => !isCallRead(request));
  const graphql = refresh.filter(({ url }) => url.endsWith("/graphql"));
  return {
    points: graphql.reduce((sum, { body }) => sum + countPoints(body), 0),
    requests: refresh.length,
  };
};

const home = makeHome(readFileSync(findFixture("team.yaml"), "utf8"));
// Each open pane has a home of its own, so it shares no cache with the
// calls above or with the other pane.
const idleHome = makeHome(readFileSync(findFixture("team.yaml"), "utf8"));
const scrollHome = makeHome(readFileSync(findFixture("team.yaml"), "utf8"));
afterAll(() => {
  for (const each of [home, idleHome, scrollHome]) each.remove();
});

// A refresh every 120 seconds: each call is two minutes after the last,
// and asks for data no older than that.
const refresh = (now: string, recording: string) =>
  home.call(["owed", "--format", "json", "--max-age", "120"], {
    now,
    recording,
  });

describe("request-budget", () => {
  const cycles = (async () => [
    await refresh("2026-09-28T10:00:00Z", "team"),
    await refresh("2026-09-28T10:02:01Z", "team"),
    await refresh("2026-09-28T10:04:02Z", "teamChanged"),
  ])();

  it("counts the points of GitHub's own worked example as GitHub does", () => {
    // 1 request for the repositories, 100 for their issues and 5,000 for
    // the issues' labels: 5,101 requests, which GitHub charges 51 points.
    const query = `query {
      viewer {
        login
        repositories(first: 100) {
          edges { node { id issues(first: 50) {
            edges { node { id labels(first: 60) { edges { node { id name } } } } }
          } } }
        }
      }
    }`;
    expect(countPoints({ query })).toBe(51);
  });

  it("fetches every repository whole for exactly the budget's points", async () => {
    const [whole] = await cycles;
    expect(whole?.code).toBe(0);
    const spent = measure(whole?.requests ?? []);
    expect(spent.points).toBe(budget.whole.points * repositories);
    expect(spent.requests).toBeLessThanOrEqual(
      budget.whole.requests * repositories,
    );
  });

  it("spends no points when nothing changed", async () => {
    const [, unchanged] = await cycles;
    expect(unchanged?.code).toBe(0);
    expect(measure(unchanged?.requests ?? [])).toEqual({
      points: budget.unchanged.points,
      requests: budget.unchanged.requests * repositories,
    });
  });

  it("fetches only what changed within the budget", async () => {
    const [, , changed] = await cycles;
    expect(changed?.code).toBe(0);
    const spent = measure(changed?.requests ?? []);
    expect(spent.points).toBeGreaterThan(0);
    expect(spent.points).toBeLessThanOrEqual(
      budget.changed.points * repositories,
    );
    expect(spent.requests).toBeLessThanOrEqual(
      budget.changed.requests * repositories,
    );
  });

  const idleDay = idleHome.open({
    now: "2026-09-29T10:00:00Z",
    until: "2026-09-30T10:00:00Z",
    recording: "team",
  });
  /** The requests an idle day sent once the pane was idle. */
  const sentIdle = async () => {
    const { requests } = await idleDay;
    const idleFrom = Date.parse("2026-09-29T10:00:00Z") + idleAfter;
    return requests.filter(({ at }) => Date.parse(at) >= idleFrom);
  };

  it("checks each repository at most every 30 minutes once a pane is left idle for a day", async () => {
    const { code } = await idleDay;
    expect(code).toBe(0);
    const checks = (await sentIdle()).filter(
      ({ method, url }) =>
        method === "GET" && new URL(url).pathname.endsWith("/issues"),
    );
    expect(checks.length).toBeGreaterThan(0);
    for (const repo of [
      "example-org/example-repo",
      "example-org/example-docs",
    ]) {
      const count = checks.filter(({ url }) => url.includes(repo)).length;
      expect(count).toBeLessThanOrEqual((day - idleAfter) / idleInterval);
    }
  }, 180_000);

  it("spends no points while an idle pane sees nothing change, and sends only the checks", async () => {
    const sent = await sentIdle();
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.filter(({ url }) => url.endsWith("/graphql"))).toEqual([]);
    const cycles = (day - idleAfter) / idleInterval;
    expect(sent.length).toBeLessThanOrEqual(cycles * repositories);
  }, 180_000);

  it("reads details at most a point a request, within 300 points an hour, while a pane is scrolled", async () => {
    const minutes = 10;
    const { code, requests } = await scrollHome.open({
      now: "2026-09-30T12:00:00Z",
      until: `2026-09-30T12:${minutes}:00Z`,
      recording: "team",
      ready: "Fix the parser",
      keys: [..."jjjkkkjjjkkkjjjkkk"],
    });
    expect(code).toBe(0);
    const reads = requests.filter(isDetailRead);
    expect(reads.length).toBeGreaterThan(0);
    for (const { body } of reads) expect(countPoints(body)).toBe(1);
    expect(reads.length).toBeLessThanOrEqual(
      (detailBudgetPerHour * minutes) / 60,
    );
  }, 180_000);

  it("never has two requests open at once", async () => {
    const sent = (await cycles).flatMap(({ requests }) => requests);
    expect(sent.length).toBeGreaterThan(0);
    expect(Math.max(...sent.map(({ inFlight }) => inFlight))).toBe(1);
  });
});
