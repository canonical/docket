import { describe, expect, it } from "vitest";
import { at, teamSettings, thread, wait } from "../../testing/facts.js";
import type { Repo } from "../config/index.js";
import groupWaits from "./groupWaits.js";
import listWaits from "./listWaits.js";

const now = at("2026-09-23T10:00+02:00");
const { time, people } = teamSettings;
const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const [example, docs] = repos as [Repo, Repo];
const later = wait({ owners: ["bob"], due: at("2026-09-24T10:00+02:00") });
const sooner = wait({
  owners: ["alice"],
  thread: thread({ repo: docs.repo, number: 7 }),
});
const list = listWaits(
  [
    { repo: example, time, people, waits: [later] },
    { repo: docs, time, people, waits: [sooner] },
  ],
  now,
);

describe("groupWaits", () => {
  it("splits the sorted rows into the sections of the address's grouping", () => {
    const owed = groupWaits(list, { mode: "owed", grouping: "repo" }, repos);
    expect(owed.groups.map(({ heading }) => heading?.text)).toEqual([
      "example",
      "docs",
    ]);
  });

  it("keeps the address, the counts and the summary of the list", () => {
    const address = { mode: "owed", grouping: "none" } as const;
    const owed = groupWaits(list, address, repos);
    expect(owed.address).toBe(address);
    expect(owed.counts).toBe(list.counts);
    expect(owed.summary).toBe(list.summary);
  });

  it("regroups the rows already built, measuring none of them again", () => {
    const byOwner = groupWaits(
      list,
      { mode: "owed", grouping: "owner" },
      repos,
    );
    const byRepo = groupWaits(list, { mode: "owed", grouping: "repo" }, repos);
    const [soonest, latest] = list.rows;
    expect(byOwner.groups.map(({ rows }) => rows)).toEqual([
      [soonest],
      [latest],
    ]);
    expect(byOwner.groups[0]?.rows[0]).toBe(soonest);
    expect(byRepo.groups[0]?.rows[0]).toBe(latest);
    expect(byRepo.groups[1]?.rows[0]).toBe(soonest);
  });
});
