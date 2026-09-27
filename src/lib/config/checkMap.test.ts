import { describe, expect, it } from "vitest";
import checkMap from "./checkMap.js";

describe("checkMap", () => {
  it("gives back every entry when no keys are named", () => {
    const map = new Map<unknown, unknown>([
      ["alice", "team"],
      ["bob", "bot"],
    ]);
    expect(checkMap(map, "people")).toEqual({
      value: new Map([
        ["alice", "team"],
        ["bob", "bot"],
      ]),
      errors: [],
    });
  });

  it("keeps the named keys and refuses the others, listing the ones it knows", () => {
    const map = new Map([
      ["issue", "1d"],
      ["commit", "2d"],
    ]);
    expect(checkMap(map, "targets.close", ["issue", "discussion"])).toEqual({
      value: new Map([["issue", "1d"]]),
      errors: [
        {
          code: "CONFIG_UNKNOWN_KEY",
          message:
            "`targets.close` has the key `commit`, which docket does not know.",
          recovery: "Remove `commit`, or use one of `issue`, `discussion`.",
        },
      ],
    });
  });

  it("refuses a key that is not text and asks for it to be quoted", () => {
    const checked = checkMap(new Map([[12, "team"]]), "people");
    expect(checked).toEqual({
      value: new Map(),
      errors: [
        {
          code: "CONFIG_WRONG_TYPE",
          message: "`people` has the key `12`, which is not text.",
          recovery: 'Quote the key, as in `"12"`.',
        },
      ],
    });
  });

  it("refuses a key that is a list or a map, asking for text instead", () => {
    const checked = checkMap(
      new Map<unknown, unknown>([
        [["alice"], "team"],
        [new Map(), "bot"],
      ]),
      "people",
    );
    expect(checked.errors.map((error) => error.recovery)).toEqual([
      "Write the key as text, not as a list or a map.",
      "Write the key as text, not as a list or a map.",
    ]);
  });

  it("refuses a value that is not a map, naming where it sits", () => {
    expect(checkMap(["alice"], "people")).toEqual({
      value: undefined,
      errors: [
        {
          code: "CONFIG_WRONG_TYPE",
          message: "`people` is not a map of keys and values.",
          recovery:
            "Write `people` as keys and values, one `key: value` per line.",
        },
      ],
    });
  });
});
