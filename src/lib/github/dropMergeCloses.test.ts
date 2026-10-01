import { describe, expect, it } from "vitest";
import { alice, bob, thread } from "../../testing/facts.js";
import type { ThreadEvent } from "../events/index.js";
import dropMergeCloses from "./dropMergeCloses.js";

const pull = thread({ kind: "pullRequest" });

/** An event on the pull request, at a second past 11:00 on 22 September. */
const at = (second: number) =>
  new Date(Date.UTC(2026, 8, 22, 11, 0, 0) + second * 1000);
const merged = (second: number): ThreadEvent => ({
  thread: pull,
  actor: alice,
  at: at(second),
  kind: "merged",
});
const closed = (second: number, actor = alice): ThreadEvent => ({
  thread: pull,
  actor,
  at: at(second),
  kind: "closed",
  ending: { outcome: "closed", label: "closed" },
});
const reopened = (second: number): ThreadEvent => ({
  thread: pull,
  actor: alice,
  at: at(second),
  kind: "reopened",
});

describe("dropMergeCloses", () => {
  it("counts a merge once, whichever second GitHub dates its close at", () => {
    for (const timeline of [
      [merged(0), closed(0)],
      [closed(0), merged(1)],
      [merged(0), closed(1, bob)],
    ]) {
      expect(dropMergeCloses(timeline).map(({ kind }) => kind)).toEqual([
        "merged",
      ]);
    }
  });

  it("keeps a close before a reopen, a close of a pull request never merged, and a close further away", () => {
    const beforeReopen = [
      closed(38, bob),
      reopened(39),
      merged(40),
      closed(41),
    ];
    expect(dropMergeCloses(beforeReopen)).toEqual(beforeReopen.slice(0, 3));
    const unmerged = [closed(0)];
    expect(dropMergeCloses(unmerged)).toEqual(unmerged);
    const furtherAway = [merged(0), closed(10, bob)];
    expect(dropMergeCloses(furtherAway)).toEqual(furtherAway);
    const reopenedBetween = [closed(39, bob), reopened(39), merged(40)];
    expect(dropMergeCloses(reopenedBetween)).toEqual(reopenedBetween);
  });

  it("drops the nearest close when one lies on each side of the merge", () => {
    const early = closed(-2, bob);
    const late = closed(1);
    expect(dropMergeCloses([early, merged(0), late])).toEqual([
      early,
      merged(0),
    ]);
  });
});
