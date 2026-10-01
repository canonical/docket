import { describe, expect, it } from "vitest";
import { builtInSettings } from "../lib/config/index.js";
import chooseWindow from "./chooseWindow.js";

const windows = builtInSettings.activity;

describe("chooseWindow", () => {
  it("takes the configured window named, or the first when none is", () => {
    expect(chooseWindow(windows, "72h", "finished")).toEqual({
      amount: 72,
      unit: "h",
    });
    expect(chooseWindow(windows, undefined, "finished")).toEqual({
      amount: 24,
      unit: "h",
    });
  });

  it("refuses a window the configuration does not list, pointing to the command's help", () => {
    expect(() => chooseWindow(windows, "5d", "finished")).toThrow(
      expect.objectContaining({
        code: "USAGE_INVALID_VALUE",
        message:
          "`--window` takes one of the configured windows, 24h, 48h, 72h, 1w, not `5d`.",
        recovery: "run docket finished --help",
      }),
    );
  });
});
