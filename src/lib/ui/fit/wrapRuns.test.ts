import { describe, expect, it } from "vitest";
import wrapRuns from "./wrapRuns.js";

/** Each line's text, its runs joined. */
const read = (lines: readonly { readonly text: string }[][]) =>
  lines.map((line) => line.map(({ text }) => text).join(""));

const owners = [
  { text: "owner ", look: "words" },
  {
    text: "○ example-contributor-with-a-long-login",
    look: "outside",
    marked: true,
  },
  { text: ", ", look: "words" },
  { text: "◐ erin", look: "internal", marked: true },
];

describe("wrapRuns", () => {
  it("keeps a line that fits whole, each run in its look", () => {
    expect(wrapRuns(owners.slice(2), 40)).toEqual([
      [
        { text: ",", look: "words" },
        { text: " ", look: "words" },
        { text: "◐ erin", look: "internal", marked: true },
      ],
    ]);
  });

  it("breaks between people, never between a mark and its login", () => {
    expect(read(wrapRuns(owners, 40))).toEqual([
      "owner",
      "○ example-contributor-with-a-long-login,",
      "◐ erin",
    ]);
  });

  it("keeps each run's look on every line it reaches", () => {
    const [, second] = wrapRuns(owners, 40);
    expect(second?.map(({ look }) => look)).toEqual(["outside", "words"]);
  });

  it("splits a word wider than a line, losing no character and keeping its looks", () => {
    const lines = wrapRuns(owners.slice(1, 3), 20);
    expect(read(lines)).toEqual([
      "○ example-contributo",
      "r-with-a-long-login,",
    ]);
    expect(lines[1]?.map(({ look }) => look)).toEqual(["outside", "words"]);
  });

  it("keeps words joined by a no-break space on one line, shown with a space", () => {
    const checks = [
      { text: "failed (lint the repository, test)", look: "error" },
    ];
    expect(read(wrapRuns(checks, 28))).toEqual([
      "failed (lint the repository,",
      "test)",
    ]);
  });

  it("wraps text as wrapText does, spaces kept where written", () => {
    expect(read(wrapRuns([{ text: "a  b c", look: "words" }], 4))).toEqual([
      "a  b",
      "c",
    ]);
  });

  it("gives one empty line for no runs", () => {
    expect(wrapRuns([], 40)).toEqual([[]]);
  });

  it("removes control sequences from every run", () => {
    expect(
      read(wrapRuns([{ text: "lint\u001b[2J ok", look: "words" }], 40)),
    ).toEqual(["lint ok"]);
  });
});
