import { describe, expect, it } from "vitest";
import wrapText from "./wrapText.js";

describe("wrapText", () => {
  it("splits a word too wide for its line between characters, never inside one", () => {
    const lines = wrapText("ab😀 cd", 3);
    expect(lines).toEqual(["ab", "😀", "cd"]);
    expect(wrapText(`Fix ${"a".repeat(37)}🚀 launch`, 38)).toEqual([
      "Fix",
      "a".repeat(37),
      "🚀 launch",
    ]);
  });

  it("gives each character a line of its own when the line is narrower than one", () => {
    expect(wrapText("😀😀", 1)).toEqual(["😀", "😀"]);
  });

  it("keeps a text that fits on one line", () => {
    expect(wrapText("Recovery: run gh auth login", 38)).toEqual([
      "Recovery: run gh auth login",
    ]);
  });

  it("breaks between words so no line is wider than the width", () => {
    expect(
      wrapText(
        "Recovery: install it from https://cli.github.com, then run gh auth login",
        38,
      ),
    ).toEqual([
      "Recovery: install it from",
      "https://cli.github.com, then run gh",
      "auth login",
    ]);
  });

  it("keeps words joined by a no-break space together, shown with a space", () => {
    expect(wrapText("then run gh auth login", 13)).toEqual([
      "then run",
      "gh auth login",
    ]);
  });

  it("splits a word wider than a line without losing a character", () => {
    expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("wraps a text written on GitHub without its escape sequences, its line breaks flowed", () => {
    expect(
      wrapText("Rebased\u001b[31m on main.\n\nCould you look?", 16),
    ).toEqual(["Rebased on main.", "Could you look?"]);
  });
});
