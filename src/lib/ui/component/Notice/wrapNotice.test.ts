import { describe, expect, it } from "vitest";
import wrapNotice from "./wrapNotice.js";

describe("wrapNotice", () => {
  it("opens the reason with ✗ and the recovery with Recovery:, each wrapped", () => {
    expect(
      wrapNotice(
        "docket needs the GitHub CLI (gh)",
        "install it from https://cli.github.com, then run gh auth login",
        38,
      ),
    ).toEqual({
      reason: ["✗ docket needs the GitHub CLI (gh)"],
      recovery: [
        "Recovery: install it from",
        "https://cli.github.com, then run",
        "gh auth login",
      ],
    });
  });

  it("keeps a command whole up to a comma, and wraps the rest", () => {
    const { recovery } = wrapNotice(
      "a reason",
      "run docket show example#12, then apply again",
      24,
    );
    expect(recovery).toEqual([
      "Recovery: run",
      "docket show example#12,",
      "then apply again",
    ]);
  });
});
