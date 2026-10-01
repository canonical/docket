import { describe, expect, it } from "vitest";
import { at, wait } from "../../testing/facts.js";
import {
  recordedNow,
  recordedOwed,
  recordedRepos,
} from "../../testing/recorded.js";
import { listWaits } from "../owed/index.js";
import describeWaitData from "./describeWaitData.js";

const [first, , soon] = recordedOwed().groups.at(0)?.rows ?? [];
if (!first || !soon) throw new Error("the recording has waits");

describe("describeWaitData", () => {
  it("gives a wait as data, its kind and its author's group as identifiers and its due time in ISO 8601", () => {
    expect(describeWaitData(soon, "standard")).toEqual({
      reference: "example#15",
      title: "Crash on start",
      kind: "response",
      author: { login: "carol", group: "internal" },
      state: "soon",
      overdue: -1 / 6,
      owners: [],
      due: "2026-09-28T14:00:00.000Z",
      draft: false,
      checksFailing: false,
      stack: null,
      invalidRepositoryFile: false,
      target: "24h",
    });
  });

  it("says when the wait's repository has an invalid file of its own", () => {
    const marked = {
      ...soon,
      invalidFile: { text: "invalid repository file", kind: "words" },
    } as const;
    expect(describeWaitData(marked, "standard").invalidRepositoryFile).toBe(
      true,
    );
  });

  it("gives the target at every level, so overdue times target is the working time past due", () => {
    const standard = describeWaitData(first, "standard");
    expect(standard).toMatchObject({ overdue: 49 / 12, target: "24h" });
    expect(standard.overdue * 24).toBe(98);
  });

  it("gives a target written in weeks in working hours on the repository's clock", () => {
    const sixDays = {
      workdays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      timezone: "Europe/Paris",
    } as const;
    const weekly = wait({
      target: { amount: 1, unit: "w" },
      due: at("2026-09-25T12:00+02:00"),
    });
    const [repo] = recordedRepos;
    if (!repo) throw new Error("the recording watches a repository");
    const [row] = listWaits(
      [{ repo, time: sixDays, people: new Map(), yours: [], waits: [weekly] }],
      recordedNow,
    ).rows;
    if (!row) throw new Error("the list has the wait");
    const data = describeWaitData(row, "standard");
    expect(data).toMatchObject({ overdue: 1 / 3, target: "144h" });
    expect(data.overdue * 144).toBe(48);
  });

  it("adds when the wait started at the detailed level", () => {
    expect(describeWaitData(first, "detailed")).toMatchObject({
      started: "2026-09-21T08:00:00.000Z",
      target: "24h",
      stack: { number: 3, position: 2, size: 3, base: "main" },
    });
  });
});
