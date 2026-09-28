import { describe, expect, it } from "vitest";
import { alice, at, dave, teamSettings, thread } from "../../testing/facts.js";
import type { Repo } from "../config/index.js";
import type { WindowEvent } from "../events/index.js";
import type { ThreadSummary } from "../waits/index.js";
import listEvents from "./listEvents.js";

const now = at("2026-09-28T10:00+02:00");
const { people } = teamSettings;
const example: Repo = {
  name: "example",
  repo: "example-org/example-repo",
  tags: [],
};
const docs: Repo = { name: "docs", repo: "example-org/example-docs", tags: [] };
const one = thread({ number: 1 });
const two = thread({ number: 2 });
const onDocs = thread({ repo: docs.repo, number: 9 });
const comment = (summary: ThreadSummary, iso: string): WindowEvent => ({
  thread: summary,
  kind: "commented",
  actor: dave,
  at: at(iso),
  bot: false,
});

describe("listEvents", () => {
  it("nests events under their thread, newest first, and orders threads by their newest event", () => {
    const events = [
      comment(one, "2026-09-28T06:00+02:00"),
      comment(two, "2026-09-28T08:00+02:00"),
      comment(one, "2026-09-28T09:00+02:00"),
    ];
    const docsEvent = comment(onDocs, "2026-09-28T07:00+02:00");
    const list = listEvents(
      [
        { repo: example, people, threads: [], events },
        { repo: docs, people, threads: [], events: [docsEvent] },
      ],
      now,
    );
    const { rows } = list;
    expect(rows.map(({ reference }) => reference.text)).toEqual([
      "example#1",
      "example#2",
      "docs#9",
    ]);
    expect(rows[0]?.events.map(({ event }) => event)).toEqual([
      events[2],
      events[0],
    ]);
  });

  it("names a thread as its newest event names it", () => {
    const renamed = { ...one, title: "Renamed" };
    const events = [
      comment(one, "2026-09-28T06:00+02:00"),
      comment(renamed, "2026-09-28T09:00+02:00"),
    ];
    const list = listEvents(
      [{ repo: example, people, threads: [], events }],
      now,
    );
    expect(list.rows[0]?.title.text).toBe("Renamed");
  });

  it("gives a row its owners from the thread's facts", () => {
    const facts = thread({ number: 1, assignees: [alice] });
    const events = [comment(one, "2026-09-28T06:00+02:00")];
    const list = listEvents(
      [{ repo: example, people, threads: [two, facts], events }],
      now,
    );
    expect(list.rows[0]?.owner?.text).toBe("alice");
  });

  it("counts the threads and events in the window", () => {
    const events = [
      comment(one, "2026-09-28T06:00+02:00"),
      comment(one, "2026-09-28T07:00+02:00"),
      comment(two, "2026-09-28T08:00+02:00"),
    ];
    const list = listEvents(
      [{ repo: example, people, threads: [], events }],
      now,
    );
    expect(list.counts).toEqual({ threads: 2, events: 3 });
    expect(list.summary).toEqual({
      text: "2 threads · 3 events",
      fit: "trimmed",
    });
  });

  it("writes one thread and one event in the singular", () => {
    const events = [comment(one, "2026-09-28T06:00+02:00")];
    const list = listEvents(
      [{ repo: example, people, threads: [], events }],
      now,
    );
    expect(list.summary.text).toBe("1 thread · 1 event");
  });

  it("gives no row when nothing happened", () => {
    const list = listEvents(
      [{ repo: example, people, threads: [], events: [] }],
      now,
    );
    expect(list.rows).toEqual([]);
    expect(list.summary.text).toBe("0 threads · 0 events");
  });

  it("marks every row of a repository whose own file is invalid, and no other", () => {
    const list = listEvents(
      [
        {
          repo: example,
          people,
          threads: [],
          events: [comment(one, "2026-09-28T09:00+02:00")],
          invalidFile: true,
        },
        {
          repo: docs,
          people,
          threads: [],
          events: [comment(onDocs, "2026-09-28T08:00+02:00")],
        },
      ],
      now,
    );
    expect(list.rows.map((row) => [row.repo, row.invalidFile])).toEqual([
      ["example", { text: "invalid repository file", fit: "trimmed" }],
      ["docs", undefined],
    ]);
  });
});
