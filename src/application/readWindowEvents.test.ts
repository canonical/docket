import { describe, expect, it, vi } from "vitest";
import {
  recordedEvents,
  recordedNow,
  recordedSettings,
  recordedWatched,
} from "../testing/recorded.js";
import readWindowEvents from "./readWindowEvents.js";

const window = { amount: 72, unit: "h" } as const;

/** Two workdays a week, Monday and Tuesday. */
const twoDays = {
  ...recordedSettings,
  time: { ...recordedSettings.time, workdays: ["mon", "tue"] as const },
};

/** example on a Monday-to-Friday clock, docs on a Monday-and-Tuesday one. */
const twoClocks = [
  ...recordedWatched().slice(0, 1),
  ...recordedWatched(twoDays).slice(1),
];

describe("readWindowEvents", () => {
  it("gives each repository's events by its owner/name", async () => {
    const read = async (repo: string) =>
      recordedEvents.filter(({ thread }) => thread.repo === repo);
    const events = await readWindowEvents(
      read,
      recordedWatched(),
      window,
      recordedNow,
    );
    expect([...events.keys()]).toEqual([
      "example-org/example-repo",
      "example-org/example-docs",
    ]);
    expect(events.get("example-org/example-docs")).toEqual(
      recordedEvents.filter(({ thread }) => thread.number === 4),
    );
  });

  it("asks for events far enough back to cover the window's working time", async () => {
    const read = vi.fn(async () => []);
    await readWindowEvents(read, recordedWatched(), window, recordedNow);
    // 72 working hours fit in one week of five workdays: a week and a day back.
    expect(read).toHaveBeenCalledWith(
      "example-org/example-repo",
      new Date("2026-09-20T10:00:00Z"),
    );
    await readWindowEvents(read, recordedWatched(twoDays), window, recordedNow);
    // Two workdays a week hold 48 hours, so 72 need two weeks.
    expect(read).toHaveBeenLastCalledWith(
      "example-org/example-docs",
      new Date("2026-09-13T10:00:00Z"),
    );
  });

  it("reaches back as far as each repository's own clock needs", async () => {
    const read = vi.fn(async () => []);
    await readWindowEvents(read, twoClocks, window, recordedNow);
    // 72 working hours take a week on five workdays, two weeks on two.
    expect(read.mock.calls).toEqual([
      ["example-org/example-repo", new Date("2026-09-20T10:00:00Z")],
      ["example-org/example-docs", new Date("2026-09-13T10:00:00Z")],
    ]);
  });
});
