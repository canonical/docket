import { describe, expect, it } from "vitest";
import { finishedThread, teamSettings } from "../../testing/facts.js";
import coverMeasures from "./coverMeasures.js";
import measureClose from "./measureClose.js";

const measured = measureClose(finishedThread(), teamSettings);

describe("coverMeasures", () => {
  it("counts the threads a measure is measured on, leaving out those it does not apply to", () => {
    const notApplicable = { kind: "close", state: "notApplicable" } as const;
    expect(coverMeasures("close", [measured, notApplicable, measured])).toEqual(
      {
        state: "measured",
        of: 2,
        pending: 0,
      },
    );
  });

  it("reads pending while any thread still waits for the measure", () => {
    const pending = { kind: "close", state: "pending" } as const;
    expect(coverMeasures("close", [measured, pending])).toEqual({
      state: "pending",
      of: 1,
      pending: 1,
    });
  });

  it("reads measured over an empty list", () => {
    expect(coverMeasures("close", [])).toEqual({
      state: "measured",
      of: 0,
      pending: 0,
    });
  });

  it("reads time to first reply and first review as unsupported, even over an empty list", () => {
    const unsupported = { kind: "firstReview", state: "unsupported" } as const;
    expect(coverMeasures("firstReview", [unsupported])).toEqual({
      state: "unsupported",
      of: 0,
      pending: 0,
    });
    expect(coverMeasures("firstResponse", [])).toMatchObject({
      state: "unsupported",
    });
  });
});
