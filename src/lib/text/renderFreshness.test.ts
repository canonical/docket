import { describe, expect, it } from "vitest";
import renderFreshness from "./renderFreshness.js";
import type { Freshness } from "./types.js";

const now = new Date("2026-09-28T10:00:00Z");
const freshness: Freshness = {
  now,
  syncedAt: new Date("2026-09-28T07:30:00Z"),
  timezone: "UTC",
  warnings: [],
  budget: {},
};

describe("renderFreshness", () => {
  it("tells a person how long ago the data was synced", () => {
    expect(renderFreshness(freshness, "plain")).toEqual(["synced 2h ago"]);
  });

  it("tells an agent when the data is from, in the zone it names, and its age", () => {
    expect(renderFreshness(freshness, "llm")).toEqual([
      "Data from 2026-09-28 07:30 UTC, 2h old.",
    ]);
  });

  it("follows with each warning in force, such as a rate limit", () => {
    const limited = {
      ...freshness,
      warnings: [
        {
          code: "GITHUB_RATE_LIMITED",
          message: "GitHub is refusing requests until 11:00.",
          recovery: "wait for the limit to reset, then refresh",
        },
      ],
    } as const;
    expect(renderFreshness(limited, "llm")).toEqual([
      "Data from 2026-09-28 07:30 UTC, 2h old.",
      "",
      "## Warning: GITHUB_RATE_LIMITED\nGitHub is refusing requests until 11:00.\nRecovery: wait for the limit to reset, then refresh",
      "",
    ]);
  });

  it("says what is left of the queries' budget, and when it resets, once less than 40% is left", () => {
    const resetAt = new Date("2026-09-28T10:20:00Z");
    const live = {
      ...freshness,
      budget: { graphql: { limit: 5000, remaining: 1750, resetAt } },
    };
    expect(renderFreshness(live, "plain")).toEqual([
      "synced 2h ago · budget 35% · resets 10:20",
    ]);
    expect(renderFreshness(live, "llm")).toEqual([
      "Data from 2026-09-28 07:30 UTC, 2h old · budget 35% · resets 10:20.",
    ]);
    const plenty = {
      ...freshness,
      budget: { graphql: { limit: 5000, remaining: 2000, resetAt } },
    };
    expect(renderFreshness(plenty, "plain")).toEqual(["synced 2h ago"]);
  });

  it("says there is no data when no repository is watched", () => {
    const none = { ...freshness, syncedAt: undefined };
    expect(renderFreshness(none, "plain")).toEqual([
      "No data: the configuration watches no repository.",
    ]);
  });
});
