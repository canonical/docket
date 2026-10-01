import { describe, expect, it } from "vitest";
import giveWay from "./giveWay.js";

const place = {
  pieces: [
    { text: "example " },
    { text: "stack 3 · 3 PRs → " },
    { text: "release/example-branch" },
  ],
  kind: "identifier" as const,
  drops: [0],
  cuts: 2,
};

const read = (room: number) =>
  giveWay(place, room)
    .runs.map(({ text }) => text)
    .join("");

describe("giveWay", () => {
  it("keeps every run whole while they fit", () => {
    expect(read(48)).toBe("example stack 3 · 3 PRs → release/example-branch");
  });

  it("drops its runs whole, in order, before cutting the one it cuts once, by its kind's rule", () => {
    expect(read(40)).toBe("stack 3 · 3 PRs → release/example-branch");
    expect(read(30)).toBe("stack 3 · 3 PRs → relea…branch");
  });

  it("gives the runs kept as they were before the cut", () => {
    expect(giveWay(place, 30).whole.map(({ text }) => text)).toEqual([
      "stack 3 · 3 PRs → ",
      "release/example-branch",
    ]);
  });

  it("cuts a single run, whatever it names to cut", () => {
    const single = {
      pieces: [{ text: "example-words" }],
      kind: "words" as const,
    };
    expect(giveWay(single, 9).runs.map(({ text }) => text)).toEqual([
      "example-…",
    ]);
  });
});
