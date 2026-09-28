import { describe, expect, it } from "vitest";
import { type ThreadEvent, timeEvents } from "../lib/events/index.js";
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
import type { Watched } from "./types.js";

const window = { amount: 72, unit: "h" } as const;

/** Times each repository's events against the window on its own clock. */
const timeAll = (
  events: ReadonlyMap<string, readonly ThreadEvent[]>,
  watched: readonly Watched[],
) =>
  new Map(
    watched.map(({ repo, resolved }) => [
      repo,
      timeEvents(events.get(repo) ?? [], window, resolved.settings),
    ]),
  );

/** The recording's events, by repository, timed. */
const recorded = timeAll(
  new Map(
    recordedWatched().map(({ repo }) => [
      repo,
      recordedEvents.filter(({ thread }) => thread.repo === repo),
    ]),
  ),
  recordedWatched(),
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
      timeAll(events, twoClocks),
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

  it("reads which events are inside the window from their times alone", () => {
    const commented = (at: Date): ThreadEvent => ({
      kind: "commented",
      thread: parserFix,
      actor: dave,
      at,
    });
    const inside = commented(at("2026-09-01T10:00+02:00"));
    const outside = commented(recordedNow);
    const events = new Map([
      [
        parserFix.repo,
        [
          { event: { ...inside, bot: false }, until: recordedNow },
          {
            event: { ...outside, bot: false },
            until: at("2026-09-28T11:59+02:00"),
          },
        ],
      ],
    ]);
    const list = buildActivity(
      events,
      recordedThreads,
      recordedWatched(),
      window,
      "none",
      recordedNow,
    );
    expect(
      list.groups
        .at(0)
        ?.rows.at(0)
        ?.events.map(({ age }) => age.text),
    ).toEqual(["27d"]);
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
