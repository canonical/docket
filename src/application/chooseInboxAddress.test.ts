import { describe, expect, it } from "vitest";
import chooseInboxAddress from "./chooseInboxAddress.js";

describe("chooseInboxAddress", () => {
  it("opens the first grouping, unread only, when the call names none", () => {
    expect(chooseInboxAddress({ by: undefined, all: false })).toEqual({
      grouping: "repo",
      filter: "unread",
    });
  });

  it("takes the grouping the call names, and the whole inbox with --all", () => {
    expect(chooseInboxAddress({ by: "reason", all: true })).toEqual({
      grouping: "reason",
      filter: "all",
    });
  });

  it("refuses a grouping the inbox lacks", () => {
    expect(() => chooseInboxAddress({ by: "owner", all: false })).toThrow(
      expect.objectContaining({
        code: "USAGE_INVALID_VALUE",
        message: "`--by` takes repo, reason, type, none, not `owner`.",
        recovery: "run docket inbox --help",
      }),
    );
  });
});
