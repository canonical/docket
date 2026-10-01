import { describe, expect, it } from "vitest";
import { builtInSettings } from "../lib/config/index.js";
import chooseFinishedAddress from "./chooseFinishedAddress.js";

const windows = builtInSettings.activity;

describe("chooseFinishedAddress", () => {
  it("takes the first configured window when --window names none", () => {
    expect(
      chooseFinishedAddress(windows, { window: undefined, by: "kind" }),
    ).toEqual({ window: { amount: 24, unit: "h" }, grouping: "kind" });
  });

  it("takes the configured window and the grouping the call names, by ending among them", () => {
    expect(
      chooseFinishedAddress(windows, { window: "1w", by: "ending" }),
    ).toEqual({ window: { amount: 1, unit: "w" }, grouping: "ending" });
  });

  it("refuses a window the configuration does not list, with finished's help as the recovery", () => {
    expect(() =>
      chooseFinishedAddress(windows, { window: "5d", by: "kind" }),
    ).toThrow(
      expect.objectContaining({
        code: "USAGE_INVALID_VALUE",
        recovery: "run docket finished --help",
      }),
    );
  });

  it("refuses a grouping finished lacks, naming its own", () => {
    expect(() =>
      chooseFinishedAddress(windows, { window: undefined, by: "owner" }),
    ).toThrow(
      expect.objectContaining({
        code: "USAGE_INVALID_VALUE",
        message: "`--by` takes kind, ending, repo, none, not `owner`.",
      }),
    );
  });
});
