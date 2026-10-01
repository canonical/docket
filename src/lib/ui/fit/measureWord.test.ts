import { describe, expect, it } from "vitest";
import measureText from "./measureText.js";
import measureWord from "./measureWord.js";

describe("measureWord", () => {
  it("counts the cells measureText counts, a word kept or not", () => {
    for (const word of ["", "plain", "été", "漢字", "👍🏽", "été"]) {
      expect(measureWord(word)).toBe(measureText(word));
    }
  });

  it("measures every word right past the words it keeps", () => {
    for (let each = 0; each < 4100; each += 1) {
      expect(measureWord(`é${each}`)).toBe(String(each).length + 1);
    }
  });
});
