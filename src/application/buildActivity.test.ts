import { describe, expect, it } from "vitest";
import type { ThreadEvent } from "../lib/events/index.js";
import { at, dave } from "../testing/facts.js";
import {
  parserFix,
  recordedActivity,
  recordedEvents,
  recordedNow,
  recordedSettings,
  recordedThreads,
  recordedWatched,
  tokensGuide,
} from "../testing/recorded.js";
import buildActivity from "./buildActivity.js";

const window = { amount: 72, unit: "h" } as const;

/** The recording's events, by repository. */
const recorded = new Map(
  recordedWatched().map(({ repo }) => [
    repo,
    recordedEvents.filter(({ thread }) => thread.repo === repo),
  ]),
);

/** example on a Monday-to-Friday clock, docs on a Monday-and-Tuesday one. */
const twoClocks = [
  ...recordedWatched().slice(0, 1),
  ...recordedWatched({
    ...recordedSettings,
    time: { ...recordedSettings.time, workdays: ["mon", "tue"] },
  }).slice(1),
];

describe("buildActivity", () => {
  it("gathers the events inside the window under their threads", () => {
    const list = buildActivity(
      recorded,
      recordedThreads,
      recordedWatched(),
      window,
      "kind",
      recordedNow,
    );
    expect(list).toEqual(recordedActivity("kind"));
  });

  it("lists nothing for a repository whose events were not given", () => {
    const list = buildActivity(
      new Map(),
      recordedThreads,
      recordedWatched(),
      window,
      "none",
      recordedNow,
    );
    expect(list.groups).toEqual([]);
    expect(list.summary.text).toBe("0 threads · 0 events");
  });

  it("keeps an event while it is inside the window on its repository's clock", () => {
    const wednesday = at("2026-09-23T10:00+02:00");
    const commented = (thread: typeof parserFix): ThreadEvent => ({
      kind: "commented",
      thread,
      actor: dave,
      at: wednesday,
    });
    const events = new Map([
      [parserFix.repo, [commented(parserFix)]],
      [tokensGuide.repo, [commented(tokensGuide)]],
    ]);
    const list = buildActivity(
      events,
      recordedThreads,
      twoClocks,
      window,
      "none",
      recordedNow,
    );
    // Wednesday 10:00 is 74 working hours before Monday 12:00 on five
    // workdays, and 12 on two, so only docs's 72-hour window holds it.
    expect(
      list.groups
        .flatMap(({ rows }) => rows)
        .map(({ reference }) => reference.text),
    ).toEqual(["docs#4"]);
  });

  it("marks the rows of a repository whose own file is invalid", () => {
    const invalid = recordedWatched(recordedSettings, [
      {
        code: "CONFIG_UNKNOWN_KEY",
        message: "The file has an unknown key.",
        recovery: "Remove it.",
      },
    ]);
    const list = buildActivity(
      recorded,
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
