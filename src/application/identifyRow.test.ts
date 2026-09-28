import { describe, expect, it } from "vitest";
import { measureRow, overReview } from "../testing/rows.js";
import identifyRow from "./identifyRow.js";

describe("identifyRow", () => {
  it("names a wait by its thread, its kind and whom it is owed by", () => {
    expect(identifyRow(overReview)).toBe("example#12 review bob");
  });

  it("tells apart two reviews requested on one pull request", () => {
    const other = measureRow({ ...overReview.wait, owners: ["carol"] });
    expect(identifyRow(other)).not.toBe(identifyRow(overReview));
  });

  it("names a wait again the same once it is measured at another instant", () => {
    const later = measureRow({ ...overReview.wait });
    expect(identifyRow(later)).toBe(identifyRow(overReview));
  });
});
