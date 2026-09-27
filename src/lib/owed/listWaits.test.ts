import { describe, expect, it } from "vitest";
import { at, teamSettings, thread, wait } from "../../testing/facts.js";
import type { Repo } from "../config/index.js";
import listWaits from "./listWaits.js";

const now = at("2026-09-23T10:00+02:00");
const { time } = teamSettings;
const address = { mode: "owed", grouping: "none" } as const;
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
      over: true,
    });
    const close = wait({
      target: { amount: 5, unit: "d" },
      due: at("2026-09-22T22:00+02:00"),
      over: true,
    });
    const onTrack = wait({ thread: onDocs, due: at("2026-09-23T20:00+02:00") });
    const list = listWaits(
      [
        { repo: example, time, waits: [close, reply] },
        { repo: docs, time, waits: [onTrack] },
      ],
      address,
      now,
    );
    expect(list.groups.map(({ rows }) => rows.map((row) => row.wait))).toEqual([
      [reply, close, onTrack],
    ]);
    expect(list.groups[0]?.rows[2]?.reference.text).toBe("docs#7");
  });

  it("keeps waits that stand equal in the order given", () => {
    const first = wait({ kind: "response" });
    const second = wait({ kind: "close" });
    const list = listWaits(
      [{ repo: example, time, waits: [first, second] }],
      address,
      now,
    );
    expect(list.groups[0]?.rows.map((row) => row.wait)).toEqual([
      first,
      second,
    ]);
  });

  it("summarises the list as counts of each state", () => {
    const over = wait({ due: at("2026-09-22T22:00+02:00"), over: true });
    const soon = wait({ due: at("2026-09-23T12:00+02:00") });
    const list = listWaits(
      [{ repo: example, time, waits: [over, soon] }],
      address,
      now,
    );
    expect(list.counts).toEqual({ over: 1, soon: 1, onTrack: 0 });
    expect(list.summary).toEqual({
      text: "1 over · 1 soon · 0 on track",
      fit: "trimmed",
    });
  });

  it("gives no section when nothing is owed, and keeps the address", () => {
    const list = listWaits([{ repo: example, time, waits: [] }], address, now);
    expect(list.address).toBe(address);
    expect(list.groups).toEqual([]);
    expect(list.summary.text).toBe("0 over · 0 soon · 0 on track");
  });
});
