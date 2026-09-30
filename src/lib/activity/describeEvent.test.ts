import { describe, expect, it } from "vitest";
import { alice, at, thread } from "../../testing/facts.js";
import type { ThreadEvent } from "../events/index.js";
import describeEvent from "./describeEvent.js";

const facts = {
  thread: thread(),
  actor: alice,
  at: at("2026-09-28T10:00+02:00"),
};

describe("describeEvent", () => {
  it("names the actor and what they did", () => {
    const kinds = [
      "opened",
      "commented",
      "reviewed",
      "merged",
      "reopened",
    ] as const;
    expect(kinds.map((kind) => describeEvent({ ...facts, kind }))).toEqual([
      "alice opened",
      "alice commented",
      "alice reviewed",
      "alice merged",
      "alice reopened",
    ]);
  });

  it("names a close in the provider's words", () => {
    const closes: ThreadEvent[] = [
      {
        ...facts,
        kind: "closed",
        ending: { outcome: "completed", label: "closed as completed" },
      },
      {
        ...facts,
        kind: "closed",
        ending: { outcome: "closed", label: "closed" },
      },
    ];
    expect(closes.map((event) => describeEvent(event))).toEqual([
      "alice closed as completed",
      "alice closed",
    ]);
  });

  it("names the detail an event carries", () => {
    const events: ThreadEvent[] = [
      { ...facts, kind: "assigned", assignee: "bob" },
      { ...facts, kind: "labelled", label: "kind=bug" },
      { ...facts, kind: "reviewRequested" },
      { ...facts, kind: "pushed", commits: 2 },
      { ...facts, kind: "pushed", commits: 1 },
      { ...facts, kind: "pushed" },
      { ...facts, kind: "checksFailed", checks: ["lint", "test"] },
    ];
    expect(events.map((event) => describeEvent(event))).toEqual([
      "alice assigned bob",
      "alice labelled kind=bug",
      "alice requested review",
      "alice pushed 2 commits",
      "alice pushed 1 commit",
      "alice pushed",
      "checks failed (lint, test)",
    ]);
  });

  it("marks every part written on GitHub the way the caller asks", () => {
    const mark = (text: string) => `<${text}>`;
    const events: ThreadEvent[] = [
      { ...facts, kind: "assigned", assignee: "bob" },
      { ...facts, kind: "labelled", label: "kind=bug" },
      { ...facts, kind: "pushed", commits: 2 },
      { ...facts, kind: "checksFailed", checks: ["lint", "test"] },
      { ...facts, kind: "commented" },
    ];
    expect(events.map((event) => describeEvent(event, mark))).toEqual([
      "<alice> assigned <bob>",
      "<alice> labelled <kind=bug>",
      "<alice> pushed 2 commits",
      "checks failed (<lint>, <test>)",
      "<alice> commented",
    ]);
  });
});
