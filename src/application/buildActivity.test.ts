import { describe, expect, it, vi } from "vitest";
import {
  recordedActivity,
  recordedNow,
  recordedProvider,
  recordedSettings,
  recordedThreads,
} from "../testing/recorded.js";
import buildActivity from "./buildActivity.js";

const window = { amount: 72, unit: "h" } as const;

describe("buildActivity", () => {
  it("gathers the events inside the window under their threads", async () => {
    const list = await buildActivity(
      recordedProvider(),
      recordedThreads,
      recordedSettings,
      window,
      "kind",
      recordedNow,
    );
    expect(list).toEqual(recordedActivity("kind"));
  });

  it("asks for events far enough back to cover the window's working time", async () => {
    const provider = recordedProvider({ events: vi.fn(async () => []) });
    await buildActivity(
      provider,
      [],
      recordedSettings,
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
    await buildActivity(provider, [], twoDays, window, "none", recordedNow);
    // Two workdays a week hold 48 hours, so 72 need two weeks.
    expect(provider.events).toHaveBeenLastCalledWith(
      "example-org/example-docs",
      new Date("2026-09-13T10:00:00Z"),
    );
  });
});
