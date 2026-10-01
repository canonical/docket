import { describe, expect, it } from "vitest";
import { finishedThread, teamSettings } from "../../testing/facts.js";
import measureFinished from "./measureFinished.js";

describe("measureFinished", () => {
  it("measures time to close and reads the other two as unsupported", () => {
    const measures = measureFinished(finishedThread(), teamSettings);
    expect(measures.close).toMatchObject({ kind: "close", state: "measured" });
    expect(measures.firstResponse).toEqual({
      kind: "firstResponse",
      state: "unsupported",
    });
    expect(measures.firstReview).toEqual({
      kind: "firstReview",
      state: "unsupported",
    });
  });
});
