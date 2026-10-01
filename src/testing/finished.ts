/**
 * A few threads that finished in the week to Friday 25 September 2026,
 * and the repositories that hold them, for finished's view model and its
 * faces. It imports nothing from vitest.
 */

import type { Repo, Settings } from "../lib/config/index.js";
import type { FinishedThread } from "../lib/endings/index.js";
import {
  type FinishedGrouping,
  type FinishedRow,
  groupEndings,
  listEndings,
  type RepoEndings,
} from "../lib/finished/index.js";
import {
  alice,
  at,
  bob,
  carol,
  dave,
  exampleSync,
  finishedThread,
  teamSettings,
} from "./facts.js";

/** Friday 25 September 2026, 12:00 in Paris. */
export const finishedNow = at("2026-09-25T12:00+02:00");

/** The team's settings, with the `dependencies` label exempt from the close clock. */
export const finishedSettings: Settings = {
  ...teamSettings,
  exempt: { close: ["dependencies"] },
};

/** A pull request alice opened and bob merged on Thursday, within its target, first in a stack. */
export const mergedChange = finishedThread({
  assignees: [alice],
  stack: { number: 3, position: 1, size: 2, base: "main" },
});

/** An issue dave opened in August and alice closed as not planned on Wednesday, past its target. */
export const notPlanned = finishedThread({
  number: 7,
  url: "https://github.com/example-org/example-repo/issues/7",
  kind: "issue",
  title: "Dark mode everywhere",
  author: dave,
  createdAt: at("2026-08-03T10:00+02:00"),
  labels: ["kind=feat"],
  ending: {
    outcome: "notPlanned",
    label: "closed as not planned",
    at: at("2026-09-23T10:00+02:00"),
    by: alice,
  },
});

/**
 * A documentation issue carol opened and bob closed as completed this
 * morning, through the merged pull request, owned by alice and bob.
 */
export const completed = finishedThread({
  repo: "example-org/example-docs",
  number: 4,
  url: "https://github.com/example-org/example-docs/issues/4",
  kind: "issue",
  title: "Where do tokens live?",
  author: carol,
  createdAt: at("2026-09-21T09:00+02:00"),
  assignees: [alice, bob],
  ending: {
    outcome: "completed",
    label: "closed as completed",
    at: at("2026-09-25T09:00+02:00"),
    by: bob,
    closer: {
      kind: "pullRequest",
      repo: "example-org/example-repo",
      number: 2,
      url: "https://github.com/example-org/example-repo/pull/2",
    },
  },
});

/** A draft pull request example-sync opened, exempt by its label, closed unmerged by alice. */
export const closedBump = finishedThread({
  number: 9,
  url: "https://github.com/example-org/example-repo/pull/9",
  title: "Update dependency example-lib to 2.0",
  author: exampleSync,
  draft: true,
  labels: ["dependencies"],
  assignees: [exampleSync],
  ending: {
    outcome: "closed",
    label: "closed",
    at: at("2026-09-22T15:00+02:00"),
    by: alice,
  },
});

/** The two watched repositories, in the configuration's order. */
export const finishedRepos: readonly Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];

/** Every repository with its threads; `invalid` marks the docs repository's file invalid. */
export function repoEndings(
  finished: readonly FinishedThread[] = [
    mergedChange,
    notPlanned,
    completed,
    closedBump,
  ],
  invalid = false,
): RepoEndings[] {
  return finishedRepos.map((repo) => ({
    repo,
    people: finishedSettings.people,
    settings: finishedSettings,
    finished: finished.filter((thread) => thread.repo === repo.repo),
    ...(invalid && repo.name === "docs" ? { invalidFile: true } : {}),
  }));
}

/**
 * finished over the week to `finishedNow`, as alice sees it, grouped as
 * asked; `invalid` marks the docs repository's file invalid.
 */
export function finishedList(
  grouping: FinishedGrouping = "kind",
  finished?: readonly FinishedThread[],
  invalid = false,
) {
  return groupEndings(
    listEndings(repoEndings(finished, invalid), finishedNow, "alice"),
    { mode: "finished", window: { amount: 1, unit: "w" }, grouping },
    finishedRepos,
  );
}

/** Issues closed as duplicates of example#7, and one closed with no reason recorded. */
export const duplicatesAndQuiet: readonly FinishedThread[] = [11, 12, 13].map(
  (number) =>
    finishedThread({
      number,
      url: `https://github.com/example-org/example-repo/issues/${number}`,
      kind: "issue",
      title: `Example issue ${number}`,
      ending:
        number === 13
          ? {
              outcome: "closed",
              label: "closed",
              at: at("2026-09-24T09:00+02:00"),
            }
          : {
              outcome: "duplicate",
              label: "closed as duplicate",
              at: at(`2026-09-24T1${number - 11}:00+02:00`),
              duplicateOf: {
                repo: "example-org/example-repo",
                number: 7,
                url: "https://github.com/example-org/example-repo/issues/7",
              },
            },
    }),
);

/** The row of finished's list, by kind, whose reference is `reference`. */
export function findFinishedRow(reference: string): FinishedRow {
  const row = finishedList()
    .groups.flatMap(({ rows }) => rows)
    .find((each) => each.reference.text === reference);
  if (!row) throw new Error(`${reference} is not listed`);
  return row;
}
