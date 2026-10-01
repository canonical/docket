import { describe, expect, it } from "vitest";
import describeDataAge from "./describeDataAge.js";

const now = new Date("2026-09-28T10:00:00Z");
const unknown = { graphql: null, rest: null };

describe("describeDataAge", () => {
  it("gives when the data was synced, its age in whole seconds, and the warnings made safe", () => {
    const age = describeDataAge({
      now,
      syncedAt: new Date("2026-09-28T09:58:59.500Z"),
      timezone: "UTC",
      warnings: [
        {
          code: "GITHUB_TIMED_OUT",
          message: "GitHub gave no answer\u001b[2J.",
          recovery: "refresh",
        },
      ],
      budget: {},
    });
    expect(age).toEqual({
      syncedAt: "2026-09-28T09:58:59.500Z",
      ageSeconds: 60,
      warnings: [
        {
          code: "GITHUB_TIMED_OUT",
          message: "GitHub gave no answer.",
          recovery: "refresh",
        },
      ],
      budget: unknown,
    });
  });

  it("gives no time and no age when no repository is watched, and never a negative age", () => {
    expect(
      describeDataAge({
        now,
        syncedAt: undefined,
        timezone: "UTC",
        warnings: [],
        budget: {},
      }),
    ).toEqual({
      syncedAt: null,
      ageSeconds: null,
      warnings: [],
      budget: unknown,
    });
    const ahead = new Date("2026-09-28T10:00:05Z");
    expect(
      describeDataAge({
        now,
        syncedAt: ahead,
        timezone: "UTC",
        warnings: [],
        budget: {},
      }).ageSeconds,
    ).toBe(0);
  });

  it("gives both budgets, whatever is left of them, each null while none is known", () => {
    const resetAt = new Date("2026-09-28T11:00:00Z");
    const { budget } = describeDataAge({
      now,
      syncedAt: now,
      timezone: "UTC",
      warnings: [],
      budget: { graphql: { limit: 5000, remaining: 4900, resetAt } },
    });
    expect(budget).toEqual({
      graphql: {
        remaining: 4900,
        limit: 5000,
        resetAt: "2026-09-28T11:00:00.000Z",
      },
      rest: null,
    });
  });
});
