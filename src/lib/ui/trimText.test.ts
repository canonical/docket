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
});
