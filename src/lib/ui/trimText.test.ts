import { describe, expect, it } from "vitest";
import trimText from "./trimText.js";

describe("trimText", () => {
  it("keeps a text that fits whole", () => {
    expect(trimText("owed", 4)).toBe("owed");
  });

  it("cuts a longer text and ends it with an ellipsis within the width", () => {
    expect(trimText("full refresh available", 10)).toBe("full refr…");
  });

  it("counts a wide character as two cells", () => {
    expect(trimText("ab😀cd", 4)).toBe("ab…");
  });

  it("counts an arrow as the one cell a terminal draws it in", () => {
    expect(trimText("owed ↔ activity", 15)).toBe("owed ↔ activity");
  });

  it("gives nothing when no cell is left", () => {
    expect(trimText("owed", 0)).toBe("");
  });

  it("draws a text written on GitHub without its escape sequences and control characters", () => {
    expect(
      trimText("Fix\u001b[2J the\u0007 parser\u001b]52;c;aGk=\u0007", 40),
    ).toBe("Fix the parser");
  });

  it("keeps a text on its line, a line break read as a space", () => {
    expect(trimText("Fix\nthe parser", 40)).toBe("Fix the parser");
  });
});
