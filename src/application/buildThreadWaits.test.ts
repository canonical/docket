import { describe, expect, it } from "vitest";
import { thread } from "../testing/facts.js";
import {
  crash,
  parserFix,
  recordedNow,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import buildOwed from "./buildOwed.js";
import buildThreadWaits from "./buildThreadWaits.js";

/** The pull request above the parser fix in its stack. */
const docsFix = thread({
  number: 13,
  kind: "pullRequest",
  title: "Document the parser",
  stack: { number: 3, position: 3, size: 3, base: "main" },
});

/** A pull request of the documentation, in a stack of the same number. */
const elsewhere = thread({
  repo: "example-org/example-docs",
  number: 7,
  kind: "pullRequest",
  title: "Rename a token",
  stack: { number: 3, position: 1, size: 1, base: "main" },
});

const threads = [...recordedThreads, docsFix, elsewhere];

const references = (rows: ReturnType<typeof buildThreadWaits>) =>
  rows.map(({ reference }) => reference.text);

describe("buildThreadWaits", () => {
  it("gives owed's rows of the thread and its stack, most pressing first", () => {
    const rows = buildThreadWaits(
      parserFix,
      threads,
      recordedWatched(),
      recordedNow,
    );
    const owed = buildOwed(threads, recordedWatched(), "none", recordedNow);
    expect(rows).toEqual(
      owed.groups
        .flatMap((group) => group.rows)
        .filter(({ reference }) =>
          ["example#12", "example#13"].includes(reference.text),
        ),
    );
    expect(new Set(references(rows))).toEqual(
      new Set(["example#12", "example#13"]),
    );
  });

  it("gives only the thread's own rows when it sits in no stack", () => {
    const rows = buildThreadWaits(
      crash,
      threads,
      recordedWatched(),
      recordedNow,
    );
    expect(new Set(references(rows))).toEqual(new Set(["example#15"]));
  });
});
