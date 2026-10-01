import { describe, expect, it } from "vitest";
import { tokens } from "../../../tokens/index.js";
import fitAccordion from "./fitAccordion.js";
import type { DetailLine } from "./types.js";

const fg = tokens["color.text"];
const trimmed = (text: string): DetailLine => ({
  pieces: [{ text, fg }],
  kind: "words",
  most: 1,
});
const wrapped = (text: string, optional?: true): DetailLine => ({
  pieces: [{ text, fg }],
  kind: "words",
  ...(optional ? { optional } : {}),
});

/** Each line's text, its runs joined. */
const read = (lines: ReturnType<typeof fitAccordion>) =>
  lines.map((line) => line.map(({ text }) => text).join(""));

describe("fitAccordion", () => {
  const owners: DetailLine = { ...wrapped("owner a b c"), yields: true };

  it("gives a line that yields no line when the others need them all, the accordion's last line ending in …", () => {
    const text = {
      body: [owners, wrapped("checks one two three")],
      stack: [trimmed("stack")],
    };
    expect(read(fitAccordion(text, 7, 4))).toEqual([
      "checks",
      "one two",
      "three",
      "stack…",
    ]);
  });

  it("ends a line that yields, when it runs out, with … after a whole name, never inside one", () => {
    const people = {
      ...wrapped(""),
      pieces: [
        { text: "owner ", fg },
        { text: "● alice", fg, marked: true },
        { text: ", ", fg },
        { text: "● bob", fg, marked: true },
        { text: ", ", fg },
        { text: "● carol-at-example", fg, marked: true },
      ],
      yields: true,
    };
    const text = { body: [people, wrapped("checks")], stack: [] };
    expect(read(fitAccordion(text, 20, 2))).toEqual([
      "owner ● alice,…",
      "checks",
    ]);
    // With no whole name kept, it gets no line, and the last line ends.
    expect(read(fitAccordion(text, 14, 2))).toEqual(["checks…"]);
  });

  it("leaves a name too long for the lines it gets whole, ending the part before it", () => {
    const people = {
      ...wrapped(""),
      pieces: [
        { text: "owner ", fg },
        { text: "● alice", fg, marked: true },
        { text: ", ", fg },
        { text: "○ example-contributor-with-a-long-login", fg, marked: true },
        { text: ", ", fg },
        { text: "● bob", fg, marked: true },
      ],
      yields: true,
    };
    const text = { body: [people, wrapped("checks")], stack: [] };
    expect(read(fitAccordion(text, 37, 3))).toEqual([
      "owner ● alice,…",
      "checks",
    ]);
    for (const lines of [2, 3, 4, 5, 6]) {
      for (const line of read(fitAccordion(text, 37, lines))) {
        expect(line.length).toBeLessThanOrEqual(37);
      }
    }
  });

  it("ends the accordion's last line with … when a line that yields has no line left at all", () => {
    const text = { body: [owners], stack: [trimmed("stack")] };
    expect(read(fitAccordion(text, 7, 1))).toEqual(["stack…"]);
  });

  it("never gives an optional line the lines of one that yields", () => {
    const text = {
      body: [owners, wrapped("checks ok"), wrapped("since x y", true)],
      stack: [],
    };
    expect(read(fitAccordion(text, 7, 4))).toEqual([
      "owner a",
      "b c",
      "checks",
      "ok",
    ]);
  });

  it("ends a line waiting on the details in a dimmed …, and never ends a last line twice", () => {
    const text = {
      body: [{ ...trimmed("push since"), pending: true }, wrapped("more")],
      stack: [],
    };
    expect(read(fitAccordion(text, 20, 1))).toEqual(["push since …"]);
    expect(fitAccordion(text, 20, 1)[0]?.at(-1)?.fg).toBe(
      tokens["color.text.muted"],
    );
    const bare = {
      body: [],
      stack: [{ ...trimmed(""), pieces: [], pending: true }],
    };
    expect(read(fitAccordion(bare, 20, 1))).toEqual(["…"]);
    const cut = {
      body: [
        { ...trimmed("example-repository"), kind: "identifier" as const },
        wrapped("more"),
      ],
      stack: [],
    };
    expect(read(fitAccordion(cut, 9, 1))).toEqual(["exam…tory"]);
  });

  it("ends a last line after a whole part, its parts that leave whole making the mark room, and cuts it only when none can", () => {
    const neighbours: DetailLine = {
      ...trimmed(""),
      pieces: [
        { text: "below #1 merged,", fg },
        { text: " above #2 open", fg },
      ],
      drops: [1],
    };
    const text = { body: [neighbours, wrapped("more")], stack: [] };
    expect(read(fitAccordion(text, 40, 1))).toEqual([
      "below #1 merged, above #2 open…",
    ]);
    expect(read(fitAccordion(text, 30, 1))).toEqual(["below #1 merged,…"]);
    expect(read(fitAccordion(text, 16, 1))).toEqual(["below #1 merged…"]);
  });

  it("ends a last line that only left a part out whole, which says nothing of what follows", () => {
    const place: DetailLine = {
      pieces: [
        { text: "example-repo ", fg },
        { text: "stack 7 · 1 of 1 · → ", fg },
        { text: "main", fg },
      ],
      kind: "words",
      most: 1,
      drops: [0],
      cuts: 2,
    };
    const owners = { ...wrapped("owner ● alice"), yields: true };
    const text = { body: [owners, trimmed("checks")], stack: [place] };
    expect(read(fitAccordion(text, 28, 2))).toEqual([
      "checks",
      "stack 7 · 1 of 1 · → main…",
    ]);
  });

  it("cuts a held line at its end when even its fixed words are wider than the room", () => {
    const line = {
      ...trimmed(""),
      kind: "identifier" as const,
      pieces: [
        { text: "stack 123 · 10 of 12 · → ", fg },
        { text: "main", fg },
      ],
      drops: [],
      cuts: 1,
    };
    expect(read(fitAccordion({ body: [line], stack: [] }, 10))).toEqual([
      "stack 123…",
    ]);
  });

  it("ends a last line cut at the limit with …, whatever its text holds", () => {
    const text = {
      body: [wrapped("Rebased on main… could someone look")],
      stack: [],
    };
    expect(read(fitAccordion(text, 20, 1))).toEqual(["Rebased on main……"]);
  });

  it("fits each line by its kind's rule: words wrap, a figure stays on one line, and a line held to one is cut by its kind's rule for a line", () => {
    const text = {
      body: [
        wrapped("one two three"),
        { pieces: [{ text: "12345 67890", fg }], kind: "figure" as const },
        {
          pieces: [{ text: "example stack 3 → main", fg }],
          kind: "identifier" as const,
          most: 1 as const,
        },
      ],
      stack: [],
    };
    expect(read(fitAccordion(text, 8))).toEqual([
      "one two",
      "three",
      "12345 6…",
      "exa…main",
    ]);
  });

  it("never draws more lines than it is given, the stack's lines cut with … when they alone pass them", () => {
    const text = {
      body: [wrapped("body")],
      stack: [wrapped("a b c d e f g h i j")],
    };
    expect(read(fitAccordion(text, 1, 8))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "…",
    ]);
    expect(fitAccordion(text, 1, 0)).toEqual([]);
    expect(fitAccordion(text, 1, -2)).toEqual([]);
  });

  it("ends the stack's last line with … when the stack leaves the body no line", () => {
    const text = {
      body: [wrapped("body")],
      stack: [trimmed("stack"), trimmed("above")],
    };
    expect(read(fitAccordion(text, 10, 2))).toEqual(["stack", "above…"]);
  });

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
