import { describe, expect, it, vi } from "vitest";
import {
  recordedActivity,
  recordedNow,
  recordedProvider,
  recordedSettings,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import buildActivity from "./buildActivity.js";

const window = { amount: 72, unit: "h" } as const;

describe("buildActivity", () => {
  it("gathers the events inside the window under their threads", async () => {
    const list = await buildActivity(
      recordedProvider().events,
      recordedThreads,
      recordedWatched(),
      window,
      "kind",
      recordedNow,
    );
    expect(list).toEqual(recordedActivity("kind"));
  });

  it("asks for events far enough back to cover the window's working time", async () => {
    const provider = recordedProvider({ events: vi.fn(async () => []) });
    await buildActivity(
      provider.events,
      [],
      recordedWatched(),
      window,
      "none",
      recordedNow,
    );
    // 72 working hours fit in one week of five workdays: a week and a day back.
    expect(provider.events).toHaveBeenCalledWith(
      "example-org/example-repo",
      new Date("2026-09-20T10:00:00Z"),
    );
    const twoDays = {
      ...recordedSettings,
      time: { ...recordedSettings.time, workdays: ["mon", "tue"] as const },
    };
    await buildActivity(
      provider.events,
      [],
      recordedWatched(twoDays),
      window,
      "none",
      recordedNow,
    );
    // Two workdays a week hold 48 hours, so 72 need two weeks.
    expect(provider.events).toHaveBeenLastCalledWith(
      "example-org/example-docs",
      new Date("2026-09-13T10:00:00Z"),
    );
  });

  it("marks the rows of a repository whose own file is invalid", async () => {
    const invalid = recordedWatched(recordedSettings, [
      {
        code: "CONFIG_UNKNOWN_KEY",
        message: "The file has an unknown key.",
        recovery: "Remove it.",
      },
    ]);
    const list = await buildActivity(
      recordedProvider().events,
      recordedThreads,
      invalid,
      window,
      "none",
      recordedNow,
    );
    expect(
      list.groups.at(0)?.rows.every(({ invalidFile }) => invalidFile),
    ).toBe(true);
  });
});
