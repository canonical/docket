import { describe, expect, it } from "vitest";
import parseYou from "./parseYou.js";

describe("parseYou", () => {
  it("reads the teams you belong to", () => {
    expect(
      parseYou(new Map([["teams", ["example-org/ui", "example-org/docs"]]])),
    ).toEqual({
      value: { teams: ["example-org/ui", "example-org/docs"] },
      errors: [],
    });
  });

  it("reads a section that lists no teams as empty", () => {
    expect(parseYou(new Map())).toEqual({ value: {}, errors: [] });
  });

  it("refuses a section that is not a map", () => {
    expect(parseYou(["example-org/ui"])).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses a key other than teams", () => {
    const checked = parseYou(new Map([["login", "alice"]]));
    expect(checked.value).toEqual({});
    expect(checked.errors).toEqual([
      {
        code: "CONFIG_UNKNOWN_KEY",
        message: "`you` has the key `login`, which docket does not know.",
        recovery: "Remove `login`, or use one of `teams`.",
      },
    ]);
  });

  it("refuses teams that are not a list", () => {
    expect(parseYou(new Map([["teams", "example-org/ui"]]))).toEqual({
      value: {},
      errors: [
        {
          code: "CONFIG_WRONG_TYPE",
          message: "`you.teams` is not a list.",
          recovery: "Write `you.teams` as a list, such as `[first, second]`.",
        },
      ],
    });
  });

  it("keeps the teams written as org/team and refuses the others", () => {
    const checked = parseYou(
      new Map([["teams", ["example-org/ui", "ui", 7, "example-org/"]]]),
    );
    expect(checked.value).toEqual({ teams: ["example-org/ui"] });
    expect(checked.errors).toEqual([
      {
        code: "CONFIG_INVALID_TEAM",
        message:
          '`you.teams` lists `"ui"`, which is not a team written as org/team.',
        recovery:
          "Write each team as its organisation and its name, such as `example-org/reviewers`.",
      },
      expect.objectContaining({
        code: "CONFIG_WRONG_TYPE",
        message: "`you.teams` holds `7`, which is not text.",
      }),
      expect.objectContaining({
        code: "CONFIG_INVALID_TEAM",
        message:
          '`you.teams` lists `"example-org/"`, which is not a team written as org/team.',
      }),
    ]);
  });
});
