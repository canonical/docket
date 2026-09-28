import { describe, expect, it } from "vitest";
import { draftClose, overReview, soonReply } from "../testing/rows.js";
import listWaiting from "./listWaiting.js";

describe("listWaiting", () => {
  it("names each thread's first wait by its reference", () => {
    const closing = { ...draftClose, reference: overReview.reference };
    expect(listWaiting([overReview, closing, soonReply])).toEqual({
      "example#12": "review",
      "example#15": "reply",
    });
  });
});
