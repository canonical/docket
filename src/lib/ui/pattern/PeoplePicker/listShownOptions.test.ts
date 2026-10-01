import { describe, expect, it } from "vitest";
import listShownOptions from "./listShownOptions.js";

const options = Array.from({ length: 9 }, (_, place) => ({
  owner: { text: `person-${place}`, kind: "person" as const },
  ticked: false,
}));

describe("listShownOptions", () => {
  it("keeps the cursor in the middle of the five options drawn where it can", () => {
    expect(listShownOptions(options, 4).first).toBe(2);
    expect(listShownOptions(options, 4).shown).toHaveLength(5);
  });

  it("draws the first five at the start and the last five at the end", () => {
    expect(listShownOptions(options, 0).first).toBe(0);
    expect(listShownOptions(options, 8).first).toBe(4);
  });

  it("draws every option when there are fewer than five", () => {
    expect(listShownOptions(options.slice(0, 3), 2)).toEqual({
      first: 0,
      shown: options.slice(0, 3),
    });
  });
});
