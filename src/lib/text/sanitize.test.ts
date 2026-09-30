import { describe, expect, it } from "vitest";
import sanitize from "./sanitize.js";

describe("sanitize", () => {
  it("removes colour and cursor sequences whole", () => {
    expect(
      sanitize("\u001b[31mred\u001b[0m and \u001b[2J\u001b[Hcleared"),
    ).toBe("red and cleared");
  });

  it("removes a clipboard write, terminated by a bell or by an escape", () => {
    expect(sanitize("a\u001b]52;c;ZXZpbA==\u0007b")).toBe("ab");
    expect(sanitize("a\u001b]0;title\u001b\\b")).toBe("ab");
  });

  it("removes the one-byte forms of control sequences and strings", () => {
    expect(sanitize("a\u009b31mb\u009d52;c;eA==\u009cc")).toBe("abc");
  });

  it("drops the rest of the text after a string that never ends", () => {
    expect(sanitize("safe\u001b]52;c;ZXZpbA==")).toBe("safe");
  });

  it("removes two-byte escapes, a lone escape, carriage returns and other controls", () => {
    expect(sanitize("a\u001bcb\u001b")).toBe("ab");
    expect(sanitize("over\rwritten\u0000\u0008\u007f")).toBe("overwritten");
  });

  it("removes every C1 control, U+0080 to U+009F", () => {
    const c1 = Array.from({ length: 32 }, (_, index) =>
      String.fromCodePoint(0x80 + index),
    );
    // A control that opens a sequence or a string takes the text after it
    // along, so each is checked apart.
    expect(c1.map((control) => sanitize(`a${control}`))).toEqual(
      c1.map(() => "a"),
    );
  });

  it("removes bidirectional overrides, isolates and marks, joiners, soft hyphens and tag characters", () => {
    expect(
      sanitize(
        "a\u202eb\u2066c\u2069d\u200ee\u061cf\u200dg\u200bh\u00adi\u{e0041}j\ufeffk",
      ),
    ).toBe("abcdefghijk");
  });

  it("puts a field on one line, each run of breaks becoming one space", () => {
    expect(sanitize("one\n\ntwo\tthree\u2028four")).toBe("one two three four");
  });

  it("keeps the lines and tabs of a block", () => {
    expect(sanitize("one\n\ttwo\r\n", true)).toBe("one\n\ttwo\n");
  });

  it("leaves text without controls as it is, emoji and accents included", () => {
    expect(sanitize("Réparer l'éditeur 🚀 → main")).toBe(
      "Réparer l'éditeur 🚀 → main",
    );
  });
});
