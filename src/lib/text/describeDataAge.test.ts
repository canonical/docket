import { expect, it } from "vitest";
import describeDataAge from "./describeDataAge.js";

const now = new Date("2026-09-28T10:00:00Z");

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
  });
});

it("gives no time and no age when no repository is watched, and never a negative age", () => {
  expect(
    describeDataAge({
      now,
      syncedAt: undefined,
      timezone: "UTC",
      warnings: [],
    }),
  ).toEqual({ syncedAt: null, ageSeconds: null, warnings: [] });
  const ahead = new Date("2026-09-28T10:00:05Z");
  expect(
    describeDataAge({ now, syncedAt: ahead, timezone: "UTC", warnings: [] })
      .ageSeconds,
  ).toBe(0);
});
