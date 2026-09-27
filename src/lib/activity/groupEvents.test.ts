import { describe, expect, it } from "vitest";
import { at, dave, teamSettings, thread } from "../../testing/facts.js";
import type { Repo } from "../config/index.js";
import type { WindowEvent } from "../events/index.js";
import groupEvents from "./groupEvents.js";
import listEvents from "./listEvents.js";

const now = at("2026-09-28T10:00+02:00");
const { people } = teamSettings;
const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const [example, docs] = repos as [Repo, Repo];
const window = { amount: 24, unit: "h" } as const;
const comment = (
  facts: Parameters<typeof thread>[0],
  iso: string,
): WindowEvent => ({
  thread: thread(facts),
  kind: "commented",
  actor: dave,
  at: at(iso),
  bot: false,
});
const list = listEvents(
  [
    {
      repo: example,
      people,
      threads: [],
      events: [
        comment({ number: 3, kind: "pullRequest" }, "2026-09-28T09:00+02:00"),
      ],
    },
    {
      repo: docs,
      people,
      threads: [],
      events: [
        comment({ repo: docs.repo, number: 1 }, "2026-09-28T06:00+02:00"),
      ],
    },
  ],
  now,
);

describe("groupEvents", () => {
  it("splits the sorted rows into the sections of the address's grouping", () => {
    const activity = groupEvents(
      list,
      { mode: "activity", window, grouping: "kind" },
      repos,
    );
    expect(activity.groups.map(({ heading }) => heading?.text)).toEqual([
      "ISSUES",
      "PULL REQUESTS",
    ]);
  });

  it("keeps the address, the counts and the summary of the list", () => {
    const address = { mode: "activity", window, grouping: "none" } as const;
    const activity = groupEvents(list, address, repos);
    expect(activity.address).toBe(address);
    expect(activity.counts).toBe(list.counts);
    expect(activity.summary).toBe(list.summary);
  });

  it("regroups the rows already built, building none of them again", () => {
    const [pull, issue] = list.rows;
    const byKind = groupEvents(
      list,
      { mode: "activity", window, grouping: "kind" },
      repos,
    );
    const byRepo = groupEvents(
      list,
      { mode: "activity", window, grouping: "repo" },
      repos,
    );
    expect(byKind.groups.map(({ rows }) => rows[0])).toEqual([issue, pull]);
    expect(byKind.groups[0]?.rows[0]).toBe(issue);
    expect(byRepo.groups[0]?.rows[0]).toBe(pull);
    expect(byRepo.groups[1]?.rows[0]).toBe(issue);
  });
});
