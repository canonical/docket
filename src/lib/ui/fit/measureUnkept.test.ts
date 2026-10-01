import { describe, expect, it } from "vitest";
import measureText from "./measureText.js";
import measureUnkept from "./measureUnkept.js";

describe("measureUnkept", () => {
  it("counts the cells measureText counts", () => {
    for (const text of ["", "plain", "Réparer ❤ une fois", "漢字 👍🏽"]) {
      expect(measureUnkept(text)).toBe(measureText(text));
    }
  });
});
