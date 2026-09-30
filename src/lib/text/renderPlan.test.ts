import { describe, expect, it } from "vitest";
import { quotedNote } from "./constants.js";
import renderPlan, { type WritePlan } from "./renderPlan.js";

const plan: WritePlan = {
  action: "assign",
  reference: "example#12",
  current: ["alice", "carol"],
  wanted: ["bob", "Carol"],
  freshness: {
    now: new Date("2026-09-28T10:00:00Z"),
    syncedAt: new Date("2026-09-28T09:58:00Z"),
    timezone: "Europe/Paris",
    warnings: [],
    budget: {},
  },
  format: "llm",
};

describe("renderPlan", () => {
  it("gives an agent the plan, says nothing changed, and gives the command that applies it", () => {
    expect(renderPlan(plan).split("\n")).toEqual([
      "# plan · assign example#12",
      "Data from 2026-09-28 11:58 Europe/Paris, 2m old.",
      quotedNote,
      "",
      '- add "bob"',
      '- remove "alice"',
      '- keep "carol"',
      "",
      "Nothing has changed. To apply the plan, run:",
      "`docket assign example#12 bob Carol --confirm`",
      "",
    ]);
    expect(renderPlan({ ...plan, format: "plain" })).toContain(
      "run:\n  docket assign example#12 bob Carol --confirm\n",
    );
  });

  it("gives a person what GitHub changed and the whole set it now records", () => {
    const applied = {
      ...plan,
      applied: ["bob", "carol"],
      format: "plain",
    } as const;
    expect(renderPlan(applied).split("\n")).toEqual([
      "assigned example#12",
      "synced 2m ago",
      "",
      "  added bob",
      "  removed alice",
      "  kept carol",
      "",
      "The assignees of example#12 are now: bob, carol.",
      "",
    ]);
  });

  it("reports the changes GitHub made when they fall short of those asked for", () => {
    const short = { ...plan, action: "review", applied: ["carol"] } as const;
    const text = renderPlan(short);
    expect(text).toContain("# requested review example#12\n");
    expect(text).not.toContain("added");
    expect(text).toContain(
      'The reviews requested of example#12 are now: "carol".',
    );
  });

  it("says there is nothing to change when the set is already the one asked for", () => {
    const same = {
      ...plan,
      wanted: ["alice", "carol"],
      format: "plain",
    } as const;
    expect(renderPlan(same)).toBe(
      "plan · assign example#12\nsynced 2m ago\n\nNothing to change: the assignees of example#12 are already: alice, carol.\n",
    );
    const empty = { ...same, current: [], wanted: [] };
    expect(renderPlan(empty)).toContain("are already: none.");
  });

  it("gives a program the changes, whether they were applied, and the command to apply them", () => {
    expect(JSON.parse(renderPlan({ ...plan, format: "json" }))).toMatchObject({
      action: "assign",
      reference: "example#12",
      add: ["bob"],
      remove: ["alice"],
      keep: ["carol"],
      applied: false,
      result: null,
      confirm: "docket assign example#12 bob Carol --confirm",
    });
    const applied = JSON.parse(
      renderPlan({ ...plan, format: "json", applied: ["bob", "carol"] }),
    );
    expect(applied).toMatchObject({
      applied: true,
      result: ["bob", "carol"],
      confirm: null,
    });
  });

  it("gives the command that applies the plan as the words asked for, each one shell word", () => {
    const spaced = { ...plan, wanted: ["bob carol", "dave;touch x"] };
    expect(renderPlan(spaced)).toContain(
      "`docket assign example#12 'bob carol' 'dave;touch x' --confirm`\n",
    );
  });

  it("prints no control sequence a login could carry", () => {
    const hostile = { ...plan, current: ["alice\u001b[2J"] };
    expect(renderPlan(hostile)).toContain('- remove "alice"\n');
  });
});
