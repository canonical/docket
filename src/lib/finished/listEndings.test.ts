import { describe, expect, it } from "vitest";
import { completed, finishedNow, repoEndings } from "../../testing/finished.js";
import listEndings from "./listEndings.js";

describe("listEndings", () => {
  it("lists every thread by its ending, newest first, across repositories", () => {
    const { rows } = listEndings(repoEndings(), finishedNow);
    expect(rows.map(({ reference }) => reference.text)).toEqual([
      "docs#4",
      "example#2",
      "example#7",
      "example#9",
    ]);
  });

  it("says what it counts, and how each measure stands across the list", () => {
    const list = listEndings(repoEndings(), finishedNow);
    expect(list.summary).toEqual({
      text: "1 merged · 3 closed · 1 over",
      fit: "trimmed",
    });
    expect(list.measures).toEqual({
      close: { state: "measured", of: 3, pending: 0 },
      firstResponse: { state: "unsupported", of: 0, pending: 0 },
      firstReview: { state: "unsupported", of: 0, pending: 0 },
    });
  });

  it("marks each row of a repository whose own file is invalid", () => {
    const { rows } = listEndings(repoEndings(undefined, true), finishedNow);
    expect(
      rows.map(({ reference, invalidFile }) => [
        reference.text,
        invalidFile?.text,
      ]),
    ).toEqual([
      ["docs#4", "invalid repository file"],
      ["example#2", undefined],
      ["example#7", undefined],
      ["example#9", undefined],
    ]);
  });

  it("names the pull request that closed an issue by its short name when its repository is watched, and whole otherwise", () => {
    const elsewhere = {
      ...completed,
      ending: {
        ...completed.ending,
        closer: {
          kind: "pullRequest" as const,
          repo: "example-org/example-site",
          number: 5,
          url: "https://github.com/example-org/example-site/pull/5",
        },
      },
    };
    const closers = (threads: (typeof completed)[]) =>
      listEndings(repoEndings(threads), finishedNow).rows.map(
        ({ closer }) => closer,
      );
    expect(closers([completed])).toEqual([
      { text: "example#2", fit: "trimmed" },
    ]);
    expect(closers([elsewhere])).toEqual([
      { text: "example-org/example-site#5", fit: "trimmed" },
    ]);
  });

  it("names no closer for an ending the provider records none for", () => {
    const [, merged] = listEndings(repoEndings(), finishedNow).rows;
    expect(merged).not.toHaveProperty("closer");
  });

  it("marks the viewer as you", () => {
    const [row] = listEndings(repoEndings(), finishedNow, "bob").rows;
    expect(row?.ending.actor?.group).toBe("you");
  });
});
