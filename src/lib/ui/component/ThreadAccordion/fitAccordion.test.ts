import { describe, expect, it } from "vitest";
import { tokens } from "../../../tokens/index.js";
import fitAccordion from "./fitAccordion.js";
import type { DetailLine } from "./types.js";

const fg = tokens["color.text"];
const trimmed = (text: string): DetailLine => ({
  pieces: [{ text, fg }],
  fit: "trimmed",
});
const wrapped = (text: string, optional?: true): DetailLine => ({
  pieces: [{ text, fg }],
  fit: "wrapped",
  ...(optional ? { optional } : {}),
});

/** Each line's text, its runs joined. */
const read = (lines: ReturnType<typeof fitAccordion>) =>
  lines.map((line) => line.map(({ text }) => text).join(""));

describe("fitAccordion", () => {
  it("wraps a wrapped line over as many lines as it needs and trims a trimmed one to one", () => {
    const text = {
      body: [trimmed("one two three"), wrapped("one two three")],
      stack: [],
    };
    expect(read(fitAccordion(text, 8))).toEqual([
      "one two…",
      "one two",
      "three",
    ]);
  });

  it("keeps the stack lines whole at the end, cutting the body before them with …", () => {
    const text = {
      body: [wrapped("a b c d e f g h")],
      stack: [trimmed("stack"), trimmed("neighbours")],
    };
    expect(read(fitAccordion(text, 10, 4))).toEqual([
      "a b c d e",
      "f g h",
      "stack",
      "neighbours",
    ]);
    expect(read(fitAccordion(text, 4, 4))).toEqual([
      "a b",
      "c d…",
      "sta…",
      "nei…",
    ]);
  });

  it("shows an optional line only when it fits whole", () => {
    const text = {
      body: [wrapped("a b c"), wrapped("since then", true)],
      stack: [],
    };
    expect(read(fitAccordion(text, 5, 2))).toEqual(["a b c"]);
    expect(read(fitAccordion(text, 10, 2))).toEqual(["a b c", "since then"]);
  });

  it("holds at most eight lines unless told otherwise", () => {
    const text = { body: [wrapped("a b c d e f g h i j")], stack: [] };
    expect(fitAccordion(text, 1)).toHaveLength(8);
  });
});
