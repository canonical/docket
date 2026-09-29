import { describe, expect, it } from "vitest";
import { at, teamSettings, thread, wait } from "../../testing/facts.js";
import {
  hourMilliseconds,
  type WorkingClock,
  weekdays,
} from "../clock/index.js";
import { builtInSettings, type Repo, type Targets } from "../config/index.js";
import { findWaits } from "../waits/index.js";
import listWaits from "./listWaits.js";

const now = at("2026-09-23T10:00+02:00");
const { time, people } = teamSettings;
const example: Repo = {
  name: "example",
  repo: "example-org/example-repo",
  tags: [],
};
const docs: Repo = { name: "docs", repo: "example-org/example-docs", tags: [] };
const onDocs = thread({ repo: docs.repo, number: 7 });

describe("listWaits", () => {
  it("sorts most overdue first, as a share of each wait's own target", () => {
    // 12 hours past a 24-hour target ranks above 12 hours past five days.
    const reply = wait({
      kind: "response",
      due: at("2026-09-22T22:00+02:00"),
    });
    const close = wait({
      target: { amount: 5, unit: "d" },
      due: at("2026-09-22T22:00+02:00"),
    });
    const onTrack = wait({ thread: onDocs, due: at("2026-09-23T20:00+02:00") });
    const list = listWaits(
      [
        { repo: example, time, people, waits: [close, reply] },
        { repo: docs, time, people, waits: [onTrack] },
      ],
      now,
    );
    expect(list.rows.map((row) => row.wait)).toEqual([reply, close, onTrack]);
    expect(list.rows[2]?.reference.text).toBe("docs#7");
  });

  it("keeps waits that stand equal in the order given", () => {
    const first = wait({ kind: "response" });
    const second = wait({ kind: "close" });
    const list = listWaits(
      [{ repo: example, time, people, waits: [first, second] }],
      now,
    );
    expect(list.rows.map((row) => row.wait)).toEqual([first, second]);
  });

  it("summarises the list as counts of each state", () => {
    const over = wait({ due: at("2026-09-22T22:00+02:00") });
    const soon = wait({ due: at("2026-09-23T12:00+02:00") });
    const list = listWaits(
      [{ repo: example, time, people, waits: [over, soon] }],
      now,
    );
    expect(list.counts).toEqual({ over: 1, soon: 1, onTrack: 0 });
    expect(list.summary).toEqual({
      text: "1 over · 1 soon · 0 on track",
      fit: "trimmed",
    });
  });

  it("gives no row when nothing is owed", () => {
    const list = listWaits([{ repo: example, time, people, waits: [] }], now);
    expect(list.rows).toEqual([]);
    expect(list.summary.text).toBe("0 over · 0 soon · 0 on track");
  });
});

describe("listWaits, later than the waits were found", () => {
  it("reads a wait found before its due time as over once listed after it", () => {
    const found = findWaits(thread(), teamSettings);
    const list = listWaits(
      [{ repo: example, time, people, waits: found }],
      at("2026-09-23T15:00+02:00"),
    );
    const reply = list.rows.find((row) => row.kind.text === "reply");
    expect(reply).toMatchObject({
      state: "over",
      distance: { text: "5h over" },
    });
    expect(list.counts.over).toBe(1);
  });
});

describe("listWaits, against targets written in days", () => {
  // The rows of the approved owed screen, as distances from `now` in
  // hours: positive past due, negative while time is left.
  const shown = [
    ["example#1201", "pullRequest", "review", 48, "over"],
    ["example#1240", "issue", "response", 14, "over"],
    ["example#1202", "pullRequest", "review", 24, "over"],
    ["docs#91", "issue", "close", -11, "soon"],
    ["docs#88", "pullRequest", "review", -9, "soon"],
    ["docs#95", "discussion", "close", -144, "onTrack"],
    ["example#1258", "pullRequest", "review", -24, "onTrack"],
    ["docs#99", "issue", "close", -288, "onTrack"],
    ["example#1233", "issue", "response", -12, "onTrack"],
    ["example#1204", "pullRequest", "close", -192, "onTrack"],
    ["example#1250", "pullRequest", "review", -48, "onTrack"],
  ] as const;
  const everyDay: WorkingClock = { workdays: weekdays, timezone: "UTC" };
  const list = (targets: Targets) => {
    const waits = (name: string) =>
      shown
        .filter(([reference]) => reference.startsWith(`${name}#`))
        .map(([reference, kind, waitKind, hours]) => {
          const due = new Date(now.getTime() - hours * hourMilliseconds);
          return wait({
            thread: thread({ kind, number: Number(reference.split("#")[1]) }),
            kind: waitKind,
            target:
              waitKind === "close"
                ? targets.close[kind]
                : targets.nextMove[waitKind],
            due,
          });
        });
    return listWaits(
      [
        { repo: example, time: everyDay, people, waits: waits("example") },
        { repo: docs, time: everyDay, people, waits: waits("docs") },
      ],
      now,
    );
  };
  const states = (owed: ReturnType<typeof listWaits>) =>
    Object.fromEntries(owed.rows.map((row) => [row.reference.text, row.state]));
  const expected = Object.fromEntries(
    shown.map(([reference, , , , state]) => [reference, state]),
  );

  it("reproduces the screen's states under the targets the screen was drawn with", () => {
    const owed = list({
      nextMove: {
        response: { amount: 24, unit: "h" },
        review: { amount: 3, unit: "d" },
      },
      close: {
        issue: { amount: 30, unit: "d" },
        pullRequest: { amount: 14, unit: "d" },
        discussion: { amount: 30, unit: "d" },
      },
    });
    expect(states(owed)).toEqual(expected);
    expect(owed.summary.text).toBe("3 over · 2 soon · 6 on track");
  });

  it("reproduces the screen's states under the built-in targets", () => {
    const owed = list(builtInSettings.targets);
    expect(states(owed)).toEqual(expected);
    expect(owed.summary.text).toBe("3 over · 2 soon · 6 on track");
  });

  it("marks every row of a repository whose own file is invalid, and no other", () => {
    const { rows } = listWaits(
      [
        { repo: example, time, people, waits: [wait()], invalidFile: true },
        { repo: docs, time, people, waits: [wait({ thread: onDocs })] },
      ],
      now,
    );
    expect(rows.map((row) => [row.repo, row.invalidFile])).toEqual(
      expect.arrayContaining([
        ["example", { text: "invalid repository file", fit: "trimmed" }],
        ["docs", undefined],
      ]),
    );
  });
});
