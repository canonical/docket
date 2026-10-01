import { describe, expect, it } from "vitest";
import measureOnce from "./measureOnce.js";
import measureText from "./measureText.js";

describe("measureOnce", () => {
  it("counts the cells measureText counts", () => {
    for (const text of ["", "plain", "Réparer ❤ une fois", "漢字 👍🏽"]) {
      expect(measureOnce(text)).toBe(measureText(text));
    }
  });
});
