import { describe, expect, it } from "vitest";
import { at, teamSettings, thread, wait } from "../../testing/facts.js";
import buildRow from "./buildRow.js";

const now = at("2026-09-23T10:00+02:00");
const stack = { number: 12, position: 2, size: 5, base: "main" };

describe("buildRow", () => {
  it("names the thread by short reference, with the kind of wait and its distance", () => {
    const reply = wait({
      thread: thread({ number: 88, title: "Example title" }),
      kind: "response",
      owners: ["alice"],
      due: at("2026-09-22T20:00+02:00"),
      over: true,
    });
    const row = buildRow(reply, "example", teamSettings.time, now);
    expect(row).toEqual({
      wait: reply,
      repo: "example",
      state: "over",
      overdue: 14 / 24,
      stacked: false,
      reference: { text: "example#88", fit: "trimmed" },
      kind: { text: "reply", fit: "trimmed" },
      distance: { text: "14h over", fit: "trimmed" },
      title: { text: "Example title", fit: "trimmed" },
      owner: { text: "alice", fit: "trimmed", cells: 12 },
    });
  });

  it("writes each kind of wait in its own word", () => {
    const words = (["response", "review", "close"] as const).map(
      (kind) =>
        buildRow(wait({ kind }), "example", teamSettings.time, now).kind.text,
    );
    expect(words).toEqual(["reply", "review", "close"]);
  });

  it("marks a pull request in a stack and shows the word draft on a draft", () => {
    const draft = thread({ kind: "pullRequest", draft: true, stack });
    const row = buildRow(
      wait({ thread: draft }),
      "example",
      teamSettings.time,
      now,
    );
    expect(row.stacked).toBe(true);
    expect(row.draft).toEqual({ text: "draft", fit: "trimmed" });
  });

  it("gives two owners a line of their own and leaves the owner off the second line", () => {
    const shared = wait({ owners: ["alice", "bob"] });
    const row = buildRow(shared, "example", teamSettings.time, now);
    expect(row.owner).toBeUndefined();
    expect(row.owners?.fields.map(({ text }) => text)).toEqual([
      "alice",
      "bob",
    ]);
  });
});
