import { describe, expect, it } from "vitest";
import {
  closedBump,
  completed,
  finishedNow,
  finishedSettings,
  mergedChange,
  notPlanned,
} from "../../testing/finished.js";
import buildRow from "./buildRow.js";

const { people } = finishedSettings;
const build = (thread = mergedChange, viewer?: string) =>
  buildRow(thread, "example", people, finishedSettings, finishedNow, viewer);
const text = (field: { text: string } | undefined) => field?.text;

describe("buildRow", () => {
  it("gives a thread that finished within its target the time it was open on line 1, and its ending as its event", () => {
    const row = build();
    expect(
      [row.reference, row.kind, row.distance, row.title].map(text),
    ).toEqual(["example#2", "PR", "open 2d", "Example change"]);
    expect(row.ending).toEqual({
      text: { text: "bob merged", fit: "trimmed" },
      actor: { text: "bob", fit: "trimmed", group: "team" },
      action: { text: "merged", fit: "trimmed" },
      age: { text: "20h", fit: "trimmed" },
    });
    expect([row.open, row.target, row.over].map(text)).toEqual([
      "open 2d",
      "target 5d",
      undefined,
    ]);
    expect(row.targetHours).toBe(120);
    expect(row.verdict).toBe("within");
  });

  it("gives a thread that finished past its target how far past on line 1", () => {
    const row = build(notPlanned);
    expect([row.distance, row.open, row.target, row.over].map(text)).toEqual([
      "7d over",
      "open 37d",
      "target 30d",
      "7d over",
    ]);
    expect(row.verdict).toBe("over");
    expect(text(row.ending.text)).toBe("alice closed as not planned");
  });

  it("gives a thread a label exempts no verdict and no target, and its ending's age on line 1", () => {
    const row = build(closedBump);
    expect(text(row.distance)).toBe("2d");
    expect(row).not.toHaveProperty("verdict");
    expect(row).not.toHaveProperty("target");
    expect(row.measures.close).toEqual({
      kind: "close",
      state: "notApplicable",
    });
    expect(text(row.draft)).toBe("draft");
  });

  it("names the author, the owners but bots, and the viewer as you", () => {
    expect(build(closedBump).owner).toEqual({
      text: "unassigned",
      fit: "trimmed",
    });
    const row = build(completed, "alice");
    expect(row.author).toEqual({
      text: "carol",
      fit: "trimmed",
      group: "internal",
    });
    expect(row.owners?.fields.map(({ text }) => text)).toEqual([
      "alice",
      "bob",
    ]);
    expect(build(mergedChange, "alice").owner).toMatchObject({ group: "you" });
  });

  it("marks a pull request in a stack, and nothing else", () => {
    expect(build(mergedChange).stacked).toBe(true);
    expect(build(notPlanned).stacked).toBe(false);
  });

  it("writes an ending nobody is recorded for in the provider's words alone", () => {
    const { by: _by, ...ending } = completed.ending;
    const row = build({ ...completed, ending });
    expect(row.ending).not.toHaveProperty("actor");
    expect(text(row.ending.text)).toBe("closed as completed");
  });
});
