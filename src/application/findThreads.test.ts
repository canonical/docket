import { describe, expect, it } from "vitest";
import {
  crash,
  parserFix,
  recordedRepos,
  recordedThreads,
} from "../testing/recorded.js";
import findThreads from "./findThreads.js";

const [example] = recordedRepos;
if (!example) throw new Error("the recording watches repositories");
const top = {
  ...parserFix,
  number: 13,
  stack: { ...parserFix.stack, position: 3 },
} as typeof parserFix;

describe("findThreads", () => {
  it("finds the thread a reference names", () => {
    const reference = {
      repo: example,
      number: 15,
      stack: false,
      length: 1,
      text: "example#15",
    };
    expect(findThreads(recordedThreads, reference)).toEqual([crash]);
  });

  it("finds every pull request of a stack, bottom first", () => {
    const reference = {
      repo: example,
      number: 3,
      stack: true,
      length: 3,
      text: "example stack 3",
    };
    expect(findThreads([top, ...recordedThreads], reference)).toEqual([
      parserFix,
      top,
    ]);
  });

  it("fails with THREAD_NOT_FOUND when no open thread answers", () => {
    for (const [number, stack] of [
      [99, false],
      [99, true],
    ] as const) {
      const reference = {
        repo: example,
        number,
        stack,
        length: 1,
        text: "example#99",
      };
      expect(() => findThreads(recordedThreads, reference)).toThrow(
        expect.objectContaining({
          code: "THREAD_NOT_FOUND",
          message:
            "No open thread of example-org/example-repo answers to example#99.",
        }),
      );
    }
  });
});
