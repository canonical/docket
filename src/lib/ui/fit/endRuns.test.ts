import { describe, expect, it } from "vitest";
import endRuns from "./endRuns.js";

const line = [
  { text: "asked by ", look: "muted" },
  { text: "● alice", look: "team" },
  { text: " 3d ago", look: "muted" },
];

describe("endRuns", () => {
  it("ends a line that has room with … in its last run's look", () => {
    expect(endRuns(line, 40)).toEqual([
      line[0],
      line[1],
      { text: " 3d ago…", look: "muted" },
    ]);
  });

  it("cuts the run that crosses the width, keeping each run's look", () => {
    expect(endRuns(line, 14)).toEqual([
      { text: "asked by ", look: "muted" },
      { text: "● al…", look: "team" },
    ]);
  });

  it("gives nothing for no runs", () => {
    expect(endRuns([], 40)).toEqual([]);
  });

  it("removes control sequences from every run", () => {
    expect(endRuns([{ text: "ok\u001b[2J", look: "muted" }], 40)).toEqual([
      { text: "ok…", look: "muted" },
    ]);
  });
});
