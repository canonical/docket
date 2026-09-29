import { describe, expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  carol,
  teamSettings,
  thread,
  wait,
} from "../../testing/facts.js";
import type { Wait } from "../waits/index.js";
import buildRow from "./buildRow.js";

const now = at("2026-09-23T10:00+02:00");
/** The row for `wait` as alice, the viewer, reads it. */
const build = (wait: Wait) =>
  buildRow(
    wait,
    "example",
    teamSettings.time,
    now,
    teamSettings.people,
    "alice",
  );
const person = (text: string, group: string) => ({
  text,
  fit: "trimmed",
  group,
});
const stack = { number: 12, position: 2, size: 5, base: "main" };

describe("buildRow", () => {
  it("names the thread by short reference, with the kind of wait and its distance", () => {
    const reply = wait({
      thread: thread({ number: 88, title: "Example title" }),
      kind: "response",
      owners: ["alice"],
      due: at("2026-09-22T20:00+02:00"),
    });
    const row = build(reply);
    expect(row).toEqual({
      wait: reply,
      repo: "example",
      state: "over",
      overdue: 14 / 24,
      targetHours: 24,
      stacked: false,
      reference: { text: "example#88", fit: "trimmed" },
      kind: { text: "reply", fit: "trimmed" },
      distance: { text: "14h over", fit: "trimmed" },
      title: { text: "Example title", fit: "trimmed" },
      author: person("dave", "outside"),
      owner: { text: "alice", fit: "trimmed" },
    });
  });

  it("names the author and each assigned owner as people, with their groups, the viewer as you", () => {
    const assigned = thread({
      assignees: [alice, { login: "Bob", type: "user" }],
    });
    const row = build(
      wait({ thread: assigned, author: carol, owners: ["alice", "bob"] }),
    );
    expect(row.author).toEqual(person("carol", "internal"));
    expect(row.owners?.fields).toEqual([
      person("alice", "you"),
      person("Bob", "team"),
    ]);
  });

  it("names a requested reviewer as a person, a requested team as text, and one the viewer is in as you", () => {
    const pull = thread({
      kind: "pullRequest",
      reviewRequests: [
        { reviewer: bob, at: now },
        { reviewer: { team: "example-org/reviewers", members: [] }, at: now },
        {
          reviewer: { team: "example-org/leads", members: ["alice"] },
          at: now,
        },
      ],
    });
    const toBob = build(
      wait({ thread: pull, kind: "review", owners: ["bob"] }),
    );
    expect(toBob.owner).toEqual(person("bob", "team"));
    const toTeam = build(
      wait({ thread: pull, kind: "review", owners: ["example-org/reviewers"] }),
    );
    expect(toTeam.owner).toEqual({
      text: "example-org/reviewers",
      fit: "trimmed",
    });
    expect(toTeam.author).toEqual(person("dave", "outside"));
    const toLeads = build(
      wait({ thread: pull, kind: "review", owners: ["example-org/leads"] }),
    );
    expect(toLeads.owner).toEqual(person("example-org/leads", "you"));
  });

  it("writes each kind of wait in its own word", () => {
    const words = (["response", "review", "close"] as const).map(
      (kind) => build(wait({ kind })).kind.text,
    );
    expect(words).toEqual(["reply", "review", "close"]);
  });

  it("marks a pull request in a stack and shows the word draft on a draft", () => {
    const draft = thread({ kind: "pullRequest", draft: true, stack });
    const row = build(wait({ thread: draft }));
    expect(row.stacked).toBe(true);
    expect(row.draft).toEqual({ text: "draft", fit: "trimmed" });
  });

  it("gives two owners a line of their own and leaves the owner off the second line", () => {
    const shared = wait({ owners: ["alice", "bob"] });
    const row = build(shared);
    expect(row.owner).toBeUndefined();
    expect(row.owners?.fields.map(({ text }) => text)).toEqual([
      "alice",
      "bob",
    ]);
  });
});
