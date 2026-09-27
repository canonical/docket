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

const now = at("2026-09-23T10:00+02:00");
const closeWaits = (...args: Parameters<typeof findWaits>) =>
  findWaits(...args).filter(({ kind }) => kind === "close");

describe("findWaits", () => {
  describe("the close clock", () => {
    it("runs on an open thread from its creation, against its kind's target", () => {
      const issue = thread();
      expect(closeWaits(issue, teamSettings, now)).toEqual([
        {
          thread: issue,
          kind: "close",
          owners: [],
          started: issue.createdAt,
          target: { amount: 30, unit: "d" },
          // Six working weeks later, after the clocks go back in October.
          due: at("2026-11-03T10:00+01:00"),
          over: false,
        },
      ]);
    });

    it("takes the target of each kind of thread", () => {
      const targets = (["issue", "pullRequest", "discussion"] as const).map(
        (kind) => closeWaits(thread({ kind }), teamSettings, now)[0]?.target,
      );
      expect(targets).toEqual([
        { amount: 30, unit: "d" },
        { amount: 5, unit: "d" },
        { amount: 14, unit: "d" },
      ]);
    });

    it("runs on a draft pull request too", () => {
      const draft = thread({ kind: "pullRequest", draft: true });
      expect(closeWaits(draft, teamSettings, now)).toHaveLength(1);
    });

    it("stops on a thread with a label the configuration exempts, whatever its case", () => {
      const settings = {
        ...teamSettings,
        exempt: { close: ["Topic: roadmap"] },
      };
      const labelled = thread({ labels: ["bug", "topic: Roadmap"] });
      expect(closeWaits(labelled, settings, now)).toEqual([]);
      const unlabelled = thread({ labels: ["bug"] });
      expect(closeWaits(unlabelled, settings, now)).toHaveLength(1);
    });

    it("belongs to every assignee", () => {
      const assigned = thread({ assignees: [alice, carol, bob] });
      expect(closeWaits(assigned, teamSettings, now)[0]?.owners).toEqual([
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
      expect(closeWaits(assigned, settings, now)[0]?.owners).toEqual(["alice"]);
      const botsOnly = thread({ assignees: [exampleSync] });
      expect(closeWaits(botsOnly, settings, now)[0]?.owners).toEqual([]);
    });

    it("is over target only once the target's working time has passed", () => {
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
      const over = (iso: string) => closeWaits(friday, settings, at(iso))[0];
      expect(over("2026-09-28T15:59+02:00")).toMatchObject({
        due: at("2026-09-28T16:00+02:00"),
        over: false,
      });
      expect(over("2026-09-28T16:00+02:00")?.over).toBe(false);
      expect(over("2026-09-28T16:01+02:00")?.over).toBe(true);
    });
  });

  it("finds no wait on a closed or merged thread", () => {
    const closed = thread({ open: false, assignees: [alice] });
    expect(findWaits(closed, teamSettings, now)).toEqual([]);
  });
});
