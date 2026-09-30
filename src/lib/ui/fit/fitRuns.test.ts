import { describe, expect, it } from "vitest";
import fitRuns from "./fitRuns.js";

const people = [
  { text: "✓ assigned", look: "words" },
  { text: " ", look: "words" },
  { text: "◉ alice", look: "you", marked: true },
  { text: ", ", look: "words" },
  { text: "○ example-contributor", look: "outside", marked: true },
];

describe("fitRuns", () => {
  it("keeps every run whole when the line fits", () => {
    expect(fitRuns(people, 60)).toEqual(people);
  });

  it("cuts a marked person in its login, keeping the mark", () => {
    expect(fitRuns(people, 26).at(-1)).toEqual({
      text: "○ exa…",
      look: "outside",
      marked: true,
    });
  });

  it("drops a person whose login would not show, and the separator before them", () => {
    expect(fitRuns(people, 22)).toEqual(people.slice(0, 3));
  });

  it("drops the separators a run left at the line's end when it gave way", () => {
    expect(fitRuns(people, 11)).toEqual(people.slice(0, 1));
  });

  it("cuts a run with no mark at its end, as any text", () => {
    expect(fitRuns(people, 5)).toEqual([{ text: "✓ as…", look: "words" }]);
  });

  it("removes control sequences from every run, which is no cut", () => {
    const hostile = [
      { text: "lint\u001b[2J", look: "field" },
      { text: " ok", look: "field" },
    ];
    expect(fitRuns(hostile, 40)).toEqual([
      { text: "lint", look: "field" },
      { text: " ok", look: "field" },
    ]);
  });

  it("gives nothing for no runs", () => {
    expect(fitRuns([], 40)).toEqual([]);
  });
});
