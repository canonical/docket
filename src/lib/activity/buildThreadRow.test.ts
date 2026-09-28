import { describe, expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  exampleSync,
  teamSettings,
  thread,
} from "../../testing/facts.js";
import type { WindowEvent } from "../events/index.js";
import buildThreadRow from "./buildThreadRow.js";

const now = at("2026-09-28T10:00+02:00");
const { people } = teamSettings;
const pull = thread({
  kind: "pullRequest",
  number: 12,
  title: "Example title",
});
const pushed: WindowEvent = {
  thread: pull,
  kind: "pushed",
  commits: 2,
  actor: alice,
  at: at("2026-09-28T09:35+02:00"),
  bot: false,
};
const opened: WindowEvent = {
  thread: pull,
  kind: "opened",
  actor: exampleSync,
  at: at("2026-09-28T07:00+02:00"),
  bot: true,
};

describe("buildThreadRow", () => {
  it("names the thread with its kind and the age of its newest event, events nested", () => {
    const facts = { ...pull, assignees: [alice] };
    const row = buildThreadRow(
      pull,
      "example",
      facts,
      people,
      [pushed, opened],
      now,
      "alice",
    );
    expect(row).toEqual({
      thread: pull,
      repo: "example",
      stacked: false,
      reference: { text: "example#12", fit: "trimmed" },
      kind: { text: "PR", fit: "trimmed" },
      distance: { text: "25m", fit: "trimmed" },
      title: { text: "Example title", fit: "trimmed" },
      owner: { text: "alice", fit: "trimmed", group: "team", viewer: true },
      events: [
        {
          event: pushed,
          text: { text: "alice pushed 2 commits", fit: "trimmed" },
          age: { text: "25m", fit: "trimmed" },
        },
        {
          event: opened,
          text: { text: "example-sync opened", fit: "trimmed" },
          age: { text: "3h", fit: "trimmed" },
        },
      ],
    });
  });

  it("writes each kind of thread in its own word", () => {
    const words = (["issue", "pullRequest", "discussion"] as const).map(
      (kind) => {
        const summary = thread({ kind });
        const event = { ...opened, thread: summary };
        return buildThreadRow(
          summary,
          "example",
          undefined,
          people,
          [event],
          now,
        ).kind.text;
      },
    );
    expect(words).toEqual(["issue", "PR", "discussion"]);
  });

  it("leaves bots out of the owners and names nobody left as unassigned", () => {
    const facts = { ...pull, assignees: [exampleSync] };
    const row = buildThreadRow(pull, "example", facts, people, [pushed], now);
    expect(row.owner?.text).toBe("unassigned");
  });

  it("lists two owners on a line of their own", () => {
    const facts = { ...pull, assignees: [alice, bob] };
    const row = buildThreadRow(pull, "example", facts, people, [pushed], now);
    expect(row.owner).toBeUndefined();
    expect(row.owners?.fields.map(({ text }) => text)).toEqual([
      "alice",
      "bob",
    ]);
  });

  it("names no owner when the thread's facts were not given", () => {
    const row = buildThreadRow(
      pull,
      "example",
      undefined,
      people,
      [pushed],
      now,
    );
    expect(row.owner).toBeUndefined();
    expect(row.owners).toBeUndefined();
  });

  it("marks a stacked pull request and shows the word draft on a draft", () => {
    const stacked = {
      ...pull,
      stack: { number: 3, position: 1, size: 2, base: "main" },
    };
    const facts = { ...stacked, draft: true };
    const row = buildThreadRow(
      stacked,
      "example",
      facts,
      people,
      [pushed],
      now,
    );
    expect(row.stacked).toBe(true);
    expect(row.draft).toEqual({ text: "draft", fit: "trimmed" });
  });
});
