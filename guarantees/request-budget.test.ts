import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import findFixture from "./findFixture.js";
import makeHome from "./makeHome.js";
import type { SentRequest } from "./types.js";

/**
 * One refresh of the watched repositories stays within the budget
 * proposed for GitHub's limits, and docket never has two requests open
 * at once, as GitHub asks of its clients.
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

const isCallRead = ({ body }: SentRequest) =>
  /^\s*query\s+(File|Viewer)\b/.test(String(body.query ?? ""));

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
afterAll(() => home.remove());

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

  it("never has two requests open at once", async () => {
    const sent = (await cycles).flatMap(({ requests }) => requests);
    expect(sent.length).toBeGreaterThan(0);
    expect(Math.max(...sent.map(({ inFlight }) => inFlight))).toBe(1);
  });
});
