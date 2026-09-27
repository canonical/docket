import { describe, expect, it } from "vitest";
import parsePeople from "./parsePeople.js";

describe("parsePeople", () => {
  it("reads each login and its group, keyed in lower case", () => {
    expect(
      parsePeople(
        new Map([
          ["Alice", "team"],
          ["bob", "internal"],
          ["carol", "external"],
          ["example-sync", "bot"],
        ]),
      ),
    ).toEqual({
      value: new Map([
        ["alice", "team"],
        ["bob", "internal"],
        ["carol", "external"],
        ["example-sync", "bot"],
      ]),
      errors: [],
    });
  });

  it("refuses a section that is not a map", () => {
    expect(parsePeople(["alice"])).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses a group it does not know", () => {
    const checked = parsePeople(new Map([["alice", "lead"]]));
    expect(checked).toEqual({
      value: new Map(),
      errors: [
        {
          code: "CONFIG_UNKNOWN_GROUP",
          message: '`people.alice` is `"lead"`, which is not a group.',
          recovery: "Write one of `team`, `internal`, `external` or `bot`.",
        },
      ],
    });
  });

  it("refuses a login listed twice in different case, keeping the first", () => {
    const checked = parsePeople(
      new Map([
        ["alice", "team"],
        ["ALICE", "bot"],
      ]),
    );
    expect(checked).toEqual({
      value: new Map([["alice", "team"]]),
      errors: [
        {
          code: "CONFIG_DUPLICATE_KEY",
          message:
            "`people` lists both `alice` and `ALICE`, which are one login, because GitHub logins ignore case.",
          recovery:
            "Keep one entry for `ALICE`, with the one group it belongs to.",
        },
      ],
    });
  });

  it("keeps the errors of keys that are not text", () => {
    const checked = parsePeople(new Map<unknown, unknown>([[1, "team"]]));
    expect(checked.value).toEqual(new Map());
    expect(checked.errors.map((error) => error.code)).toEqual([
      "CONFIG_WRONG_TYPE",
    ]);
  });
});
