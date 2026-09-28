import { describe, expect, it, vi } from "vitest";
import { at, dave } from "../testing/facts.js";
import {
  parserFix,
  recordedActivity,
  recordedNow,
  recordedProvider,
  recordedSettings,
  recordedThreads,
  recordedWatched,
  tokensGuide,
} from "../testing/recorded.js";
import buildActivity from "./buildActivity.js";

const window = { amount: 72, unit: "h" } as const;

/** example on a Monday-to-Friday clock, docs on a Monday-and-Tuesday one. */
const twoClocks = [
  ...recordedWatched().slice(0, 1),
  ...recordedWatched({
    ...recordedSettings,
    time: { ...recordedSettings.time, workdays: ["mon", "tue"] },
  }).slice(1),
];

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

  it("reaches back as far as each repository's own clock needs", async () => {
    const provider = recordedProvider({ events: vi.fn(async () => []) });
    await buildActivity(
      provider.events,
      [],
      twoClocks,
      window,
      "none",
      recordedNow,
    );
    // 72 working hours take a week on five workdays, two weeks on two.
    expect(provider.events).toHaveBeenCalledWith(
      "example-org/example-repo",
      new Date("2026-09-20T10:00:00Z"),
    );
    expect(provider.events).toHaveBeenCalledWith(
      "example-org/example-docs",
      new Date("2026-09-13T10:00:00Z"),
    );
  });

  it("keeps an event while it is inside the window on its repository's clock", async () => {
    const wednesday = at("2026-09-23T10:00+02:00");
    const provider = recordedProvider({
      events: async (repo) => [
        {
          kind: "commented",
          thread: repo === parserFix.repo ? parserFix : tokensGuide,
          actor: dave,
          at: wednesday,
        },
      ],
    });
    const list = await buildActivity(
      provider.events,
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
