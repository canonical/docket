import { describe, expect, it } from "vitest";
import describeFailure from "./describeFailure.js";

describe("describeFailure", () => {
  it("gives a named failure's code, message and recovery as they are", () => {
    const named = Object.assign(new Error("gh is not signed in."), {
      code: "GH_NOT_SIGNED_IN",
      recovery: "run gh auth login",
    });
    expect(describeFailure(named)).toEqual({
      code: "GH_NOT_SIGNED_IN",
      message: "gh is not signed in.",
      recovery: "run gh auth login",
    });
  });

  it("names any other failure UNEXPECTED_FAILURE, with its cause as a sentence", () => {
    const recovery = "run the command again; if it keeps failing, report it";
    expect(describeFailure(new TypeError("a defect"))).toEqual({
      code: "UNEXPECTED_FAILURE",
      message: "docket stopped on a failure it has no name for: a defect.",
      recovery,
    });
    expect(describeFailure("Out of memory!").message).toBe(
      "docket stopped on a failure it has no name for: Out of memory!",
    );
    expect(describeFailure(new Error("")).message).toBe(
      "docket stopped on a failure it has no name for.",
    );
  });
});
