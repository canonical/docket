import { describe, expect, it } from "vitest";
import {
  finishedNow,
  finishedRepos,
  repoEndings,
} from "../../testing/finished.js";
import groupEndings from "./groupEndings.js";
import listEndings from "./listEndings.js";
import type { FinishedGrouping } from "./types.js";

const window = { amount: 1, unit: "w" } as const;
const list = listEndings(repoEndings(), finishedNow);
const group = (grouping: FinishedGrouping, from = list) =>
  groupEndings(from, { mode: "finished", window, grouping }, finishedRepos);
const sections = (grouping: FinishedGrouping) =>
  group(grouping).groups.map(({ heading, rows }) => [
    heading?.text,
    rows.map(({ reference }) => reference.text),
  ]);

describe("groupEndings", () => {
  it("groups by kind of thread, issues first", () => {
    expect(sections("kind")).toEqual([
      ["ISSUES", ["docs#4", "example#7"]],
      ["PULL REQUESTS", ["example#2", "example#9"]],
    ]);
  });

  it("groups by ending in the provider's words, by kind and then in GitHub's order", () => {
    expect(sections("ending")).toEqual([
      ["closed as completed", ["docs#4"]],
      ["closed as not planned", ["example#7"]],
      ["merged", ["example#2"]],
      ["closed", ["example#9"]],
    ]);
  });

  it("groups by repository in the configuration's order", () => {
    expect(sections("repo")).toEqual([
      ["example", ["example#2", "example#7", "example#9"]],
      ["docs", ["docs#4"]],
    ]);
  });

  it("keeps one list without a heading, and the figures whatever the grouping", () => {
    expect(sections("none")).toEqual([
      [undefined, ["docs#4", "example#2", "example#7", "example#9"]],
    ]);
    const grouped = group("ending");
    expect(grouped.summary).toEqual(list.summary);
    expect(grouped.counts).toEqual(list.counts);
    expect(grouped.measures).toEqual(list.measures);
    expect(grouped).not.toHaveProperty("empty");
  });

  it("names an empty window by what it holds nothing of", () => {
    const empty = group("kind", listEndings(repoEndings([]), finishedNow));
    expect(empty.groups).toEqual([]);
    expect(empty.empty).toEqual({
      text: "nothing merged or closed in 1w",
      fit: "trimmed",
    });
  });
});
