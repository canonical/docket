import { expect, it } from "vitest";
import { recordedRepos } from "../testing/recorded.js";
import parseReference from "./parseReference.js";

const [example] = recordedRepos;

it("reads a thread as <repo>#<number> and a stack as <repo> stack <number>", () => {
  expect(
    parseReference(["example#12", "extra"], recordedRepos, "show"),
  ).toEqual({
    repo: example,
    number: 12,
    stack: false,
    length: 1,
    text: "example#12",
  });
  expect(
    parseReference(["example", "stack", "3"], recordedRepos, "show"),
  ).toEqual({
    repo: example,
    number: 3,
    stack: true,
    length: 3,
    text: "example stack 3",
  });
});

it("refuses a reference to no watched repository, naming the short names", () => {
  expect(() =>
    parseReference(["example", "stack"], recordedRepos, "show"),
  ).toThrow(
    expect.objectContaining({
      code: "USAGE_INVALID_REFERENCE",
      message:
        "`example stack` names no thread of a watched repository; the short names are: example, docs.",
      recovery: "write the reference as <repo>#<number>, such as example#12",
    }),
  );
  expect(() => parseReference(["x#1"], [], "show")).toThrow(
    expect.objectContaining({
      message:
        "`x#1` names no thread of a watched repository; the short names are: none.",
    }),
  );
});
