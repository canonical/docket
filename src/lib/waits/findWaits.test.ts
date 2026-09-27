import { describe, expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  carol,
  exampleSync,
  teamSettings,
  thread,
} from "../../testing/facts.js";
import findWaits from "./findWaits.js";

const closeWaits = (...args: Parameters<typeof findWaits>) =>
  findWaits(...args).filter(({ kind }) => kind === "close");

describe("findWaits", () => {
  describe("the close clock", () => {
    it("runs on an open thread from its creation, against its kind's target", () => {
      const issue = thread();
      expect(closeWaits(issue, teamSettings)).toEqual([
        {
          thread: issue,
          kind: "close",
          owners: [],
          started: issue.createdAt,
          target: { amount: 30, unit: "d" },
          // Six working weeks later, after the clocks go back in October.
          due: at("2026-11-03T10:00+01:00"),
        },
      ]);
    });

    it("takes the target of each kind of thread", () => {
      const targets = (["issue", "pullRequest", "discussion"] as const).map(
        (kind) => closeWaits(thread({ kind }), teamSettings)[0]?.target,
      );
      expect(targets).toEqual([
        { amount: 30, unit: "d" },
        { amount: 5, unit: "d" },
        { amount: 14, unit: "d" },
      ]);
    });

    it("runs on a draft pull request too", () => {
      const draft = thread({ kind: "pullRequest", draft: true });
      expect(closeWaits(draft, teamSettings)).toHaveLength(1);
    });

    it("stops on a thread with a label the configuration exempts, whatever its case", () => {
      const settings = {
        ...teamSettings,
        exempt: { close: ["Topic: roadmap"] },
      };
      const labelled = thread({ labels: ["bug", "topic: Roadmap"] });
      expect(closeWaits(labelled, settings)).toEqual([]);
      const unlabelled = thread({ labels: ["bug"] });
      expect(closeWaits(unlabelled, settings)).toHaveLength(1);
    });

    it("belongs to every assignee", () => {
      const assigned = thread({ assignees: [alice, carol, bob] });
      expect(closeWaits(assigned, teamSettings)[0]?.owners).toEqual([
        "alice",
        "carol",
        "bob",
      ]);
    });

    it("never belongs to a bot, by account type or by configuration", () => {
      const settings = {
        ...teamSettings,
        people: new Map([["carol", "bot" as const]]),
      };
      const assigned = thread({ assignees: [exampleSync, carol, alice] });
      expect(closeWaits(assigned, settings)[0]?.owners).toEqual(["alice"]);
      const botsOnly = thread({ assignees: [exampleSync] });
      expect(closeWaits(botsOnly, settings)[0]?.owners).toEqual([]);
    });

    it("runs on a thread a bot opened, which waits for no reply", () => {
      const botOpened = thread({ kind: "pullRequest", author: exampleSync });
      expect(
        findWaits(botOpened, teamSettings).map(({ kind }) => kind),
      ).toEqual(["close"]);
    });

    it("falls due once the target's working time has passed, skipping the weekend", () => {
      const settings = {
        ...teamSettings,
        targets: {
          ...teamSettings.targets,
          close: {
            ...teamSettings.targets.close,
            issue: { amount: 1, unit: "d" },
          },
        },
      } as const;
      const friday = thread({ createdAt: at("2026-09-25T16:00+02:00") });
      const [close] = closeWaits(friday, settings);
      expect(close?.due).toEqual(at("2026-09-28T16:00+02:00"));
    });
  });

  describe("the response wait", () => {
    it("runs from the earliest unanswered message, against the response target", () => {
      const issue = thread({ assignees: [alice, bob] });
      expect(findWaits(issue, teamSettings)[0]).toEqual({
        thread: issue,
        kind: "response",
        owners: ["alice", "bob"],
        started: issue.createdAt,
        target: { amount: 24, unit: "h" },
        due: at("2026-09-23T10:00+02:00"),
      });
    });

    it("does not run once the team has the last word", () => {
      const answered = thread({
        comments: [{ author: bob, at: at("2026-09-22T11:00+02:00") }],
      });
      const kinds = findWaits(answered, teamSettings).map(({ kind }) => kind);
      expect(kinds).toEqual(["close"]);
    });
  });

  it("gives each requested review its own wait, owned by the reviewer, against the review target", () => {
    const pull = thread({
      kind: "pullRequest",
      author: alice,
      assignees: [alice],
      reviewRequests: [
        { reviewer: bob, at: at("2026-09-22T11:00+02:00") },
        { reviewer: carol, at: at("2026-09-22T11:00+02:00") },
      ],
    });
    const reviews = findWaits(pull, teamSettings).filter(
      ({ kind }) => kind === "review",
    );
    expect(reviews.map(({ owners }) => owners)).toEqual([["bob"], ["carol"]]);
    expect(reviews[0]).toMatchObject({
      started: at("2026-09-22T11:00+02:00"),
      target: { amount: 2, unit: "d" },
      due: at("2026-09-24T11:00+02:00"),
    });
  });

  it("finds no wait on a closed or merged thread", () => {
    const closed = thread({ open: false, assignees: [alice] });
    expect(findWaits(closed, teamSettings)).toEqual([]);
  });
});
