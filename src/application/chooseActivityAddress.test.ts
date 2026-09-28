import { describe, expect, it } from "vitest";
import { builtInSettings } from "../lib/config/index.js";
import chooseActivityAddress from "./chooseActivityAddress.js";

const windows = builtInSettings.activity;

describe("chooseActivityAddress", () => {
  it("takes the first configured window when --window names none", () => {
    expect(
      chooseActivityAddress(windows, { window: undefined, by: "kind" }),
    ).toEqual({
      window: { amount: 24, unit: "h" },
      grouping: "kind",
    });
  });

  it("takes the configured window and the grouping the call names", () => {
    expect(
      chooseActivityAddress(windows, { window: "1w", by: "none" }),
    ).toEqual({ window: { amount: 1, unit: "w" }, grouping: "none" });
  });

  it("refuses a window the configuration does not list, naming those it does", () => {
    expect(() =>
      chooseActivityAddress(windows, { window: "5d", by: "kind" }),
    ).toThrow(
      expect.objectContaining({
        code: "USAGE_INVALID_VALUE",
        message:
          "`--window` takes one of the configured windows, 24h, 48h, 72h, 1w, not `5d`.",
        recovery: "run docket activity --help",
      }),
    );
  });

  it("refuses a grouping activity lacks, naming its own", () => {
    expect(() =>
      chooseActivityAddress(windows, { window: undefined, by: "owner" }),
    ).toThrow(
      expect.objectContaining({
        code: "USAGE_INVALID_VALUE",
        message: "`--by` takes kind, repo, none, not `owner`.",
      }),
    );
  });
});
