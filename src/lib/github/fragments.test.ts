import { describe, expect, it } from "vitest";
import fragments from "./fragments.js";

/** A selection read as a tree: each field, and what it selects in turn. */
type Tree = { readonly [field: string]: Tree | true };

/**
 * Reads a GraphQL selection into a tree, throwing on a brace left open or
 * closed twice, or an inline fragment without its type. Arguments in
 * parentheses are skipped; an inline fragment is keyed `on Type`.
 */
function select(text: string): Tree {
  const tokens = text.replace(/\([^)]*\)/g, "").match(/\.\.\.|[{}]|\w+/g) ?? [];
  let at = 0;
  const level = (nested: boolean): Tree => {
    const tree: Record<string, Tree | true> = {};
    while (at < tokens.length) {
      const token = tokens[at++];
      if (token === "}") {
        if (!nested) throw new Error("a brace is closed that was not open");
        return tree;
      }
      if (token === "{") throw new Error("a selection has no field");
      let key = token as string;
      if (token === "...") {
        if (tokens[at++] !== "on") throw new Error("a fragment has no type");
        key = `on ${tokens[at++]}`;
      }
      if (tokens[at] === "{") {
        at++;
        tree[key] = level(true);
      } else {
        tree[key] = true;
      }
    }
    if (nested) throw new Error("a brace is left open");
    return tree;
  };
  return level(false);
}

const account = { login: true, __typename: true };

describe("fragments", () => {
  it("selects the rate figures", () => {
    expect(select(fragments.rateLimit)).toEqual({
      rateLimit: { limit: true, remaining: true, resetAt: true },
    });
  });

  it("selects an account's login and its type", () => {
    expect(select(fragments.account)).toEqual(account);
  });

  it("selects the author of something written and their tie to the repository", () => {
    expect(select(fragments.written)).toEqual({
      author: account,
      authorAssociation: true,
    });
  });

  it("selects a requested reviewer as a person, a bot or a team", () => {
    expect(select(fragments.requestedReviewer)).toEqual({
      requestedReviewer: {
        __typename: true,
        "on User": { login: true },
        "on Bot": { login: true },
        "on Team": { combinedSlug: true },
      },
    });
  });

  it("selects a check run or a commit status", () => {
    expect(select(fragments.check)).toEqual({
      __typename: true,
      "on CheckRun": {
        name: true,
        status: true,
        conclusion: true,
        completedAt: true,
        checkSuite: { app: { slug: true } },
      },
      "on StatusContext": {
        context: true,
        state: true,
        createdAt: true,
        creator: account,
      },
    });
  });

  it("selects where a pull request sits in its stack", () => {
    expect(select(fragments.stackEntry)).toEqual({
      stackEntry: {
        position: true,
        stack: { number: true, size: true, baseRefName: true },
      },
    });
  });

  it("selects where the next page starts", () => {
    expect(select(fragments.pageInfo)).toEqual({
      pageInfo: { hasNextPage: true, endCursor: true },
    });
  });

  it("orders a list by update, newest first", () => {
    expect(fragments.order).toBe(
      "orderBy: { field: UPDATED_AT, direction: DESC }",
    );
  });
});
