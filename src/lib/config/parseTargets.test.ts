import { describe, expect, it } from "vitest";
import parseTargets from "./parseTargets.js";

describe("parseTargets", () => {
  it("reads both metrics, renaming each key as the model names it", () => {
    expect(
      parseTargets(
        new Map([
          [
            "next-move",
            new Map([
              ["response", "8h"],
              ["review", "1d"],
            ]),
          ],
          [
            "close",
            new Map([
              ["issue", "20d"],
              ["pull-request", "3d"],
              ["discussion", "1w"],
            ]),
          ],
        ]),
      ),
    ).toEqual({
      value: {
        nextMove: {
          response: { amount: 8, unit: "h" },
          review: { amount: 1, unit: "d" },
        },
        close: {
          issue: { amount: 20, unit: "d" },
          pullRequest: { amount: 3, unit: "d" },
          discussion: { amount: 1, unit: "w" },
        },
      },
      errors: [],
    });
  });

  it("keeps only the metrics and keys a section declares", () => {
    expect(
      parseTargets(new Map([["close", new Map([["issue", "10d"]])]])),
    ).toEqual({
      value: { close: { issue: { amount: 10, unit: "d" } } },
      errors: [],
    });
  });

  it("refuses a section that is not a map", () => {
    expect(parseTargets("24h")).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses a metric it does not know", () => {
    const checked = parseTargets(new Map([["merge", new Map()]]));
    expect(checked).toEqual({
      value: {},
      errors: [
        expect.objectContaining({
          code: "CONFIG_UNKNOWN_KEY",
          message: "`targets` has the key `merge`, which docket does not know.",
        }),
      ],
    });
  });

  it("refuses a metric that is not a map", () => {
    const checked = parseTargets(new Map([["close", "20d"]]));
    expect(checked.value).toEqual({});
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_WRONG_TYPE",
        message: "`targets.close` is not a map of keys and values.",
      }),
    ]);
  });

  it("refuses a kind of wait it does not know, listing the ones it knows", () => {
    const checked = parseTargets(
      new Map([["next-move", new Map([["merge", "1d"]])]]),
    );
    expect(checked.value).toEqual({ nextMove: {} });
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_UNKNOWN_KEY",
        recovery: "Remove `merge`, or use one of `response`, `review`.",
      }),
    ]);
  });

  it("refuses a duration it cannot read, naming the full path", () => {
    const checked = parseTargets(
      new Map([["close", new Map([["pull-request", "soon"]])]]),
    );
    expect(checked.value).toEqual({ close: {} });
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_INVALID_DURATION",
        message:
          '`targets.close.pull-request` is `"soon"`, which is not a duration.',
      }),
    ]);
  });
});
