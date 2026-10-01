/**
 * A week of threads that finished across the recording's two
 * repositories, at `recordedNow`, for the terminal's finished screens:
 * pull requests merged within their target and past it, two of them in
 * stacks, issues closed as completed and as not planned, and a bot's
 * threads. It imports nothing from vitest.
 */

import type { FinishedThread } from "../lib/endings/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { alice, at, bob, carol, dave, exampleSync } from "./facts.js";
import { parserFixDetail } from "./recorded.js";

const exampleRepo = "example-org/example-repo";
const docsRepo = "example-org/example-docs";

/** A thread of `repo` that finished, numbered `number`. */
function ended(
  repo: string,
  number: number,
  facts: Omit<FinishedThread, "repo" | "number" | "url" | "draft">,
): FinishedThread {
  const path = facts.kind === "pullRequest" ? "pull" : "issues";
  return {
    repo,
    number,
    url: `https://github.com/${repo}/${path}/${number}`,
    draft: false,
    ...facts,
  };
}

/** Every thread that finished in the week to `recordedNow`, newest ending first. */
export const weekEndings: readonly FinishedThread[] = [
  ended(exampleRepo, 1200, {
    kind: "pullRequest",
    title: "Focus ring: token names",
    stack: { number: 12, position: 1, size: 5, base: "main" },
    author: bob,
    createdAt: at("2026-09-23T06:00+02:00"),
    labels: [],
    assignees: [bob],
    ending: {
      outcome: "merged",
      label: "merged",
      at: at("2026-09-28T06:00+02:00"),
      by: alice,
    },
  }),
  ended(docsRepo, 102, {
    kind: "issue",
    title: "Table: sticky header scrolls away",
    author: dave,
    createdAt: at("2026-09-23T11:00+02:00"),
    labels: ["kind=bug"],
    assignees: [alice],
    ending: {
      outcome: "completed",
      label: "closed as completed",
      at: at("2026-09-27T11:00+02:00"),
      by: alice,
    },
  }),
  ended(exampleRepo, 1180, {
    kind: "pullRequest",
    title: "Chip: token migration",
    stack: { number: 11, position: 3, size: 3, base: "main" },
    author: bob,
    createdAt: at("2026-09-15T00:00+02:00"),
    labels: ["kind=feat"],
    assignees: [bob],
    ending: {
      outcome: "merged",
      label: "merged",
      at: at("2026-09-26T10:00+02:00"),
      by: bob,
    },
  }),
  ended(docsRepo, 77, {
    kind: "issue",
    title: "Tokens page: contrast",
    author: carol,
    createdAt: at("2026-08-03T00:00+02:00"),
    labels: ["kind=bug"],
    assignees: [],
    ending: {
      outcome: "notPlanned",
      label: "closed as not planned",
      at: at("2026-09-26T09:00+02:00"),
      by: bob,
    },
  }),
  ended(exampleRepo, 1244, {
    kind: "pullRequest",
    title: "Update dependency example-lib to 3.2",
    author: exampleSync,
    createdAt: at("2026-09-23T10:00+02:00"),
    labels: ["dependencies"],
    assignees: [bob],
    ending: {
      outcome: "merged",
      label: "merged",
      at: at("2026-09-25T10:00+02:00"),
      by: bob,
    },
  }),
  ended(exampleRepo, 1195, {
    kind: "pullRequest",
    title: "Focus ring: base tokens",
    author: bob,
    createdAt: at("2026-09-18T10:00+02:00"),
    labels: [],
    assignees: [bob],
    ending: {
      outcome: "merged",
      label: "merged",
      at: at("2026-09-24T10:00+02:00"),
      by: alice,
    },
  }),
  ended(docsRepo, 98, {
    kind: "issue",
    title: "Sync: guard tripped",
    author: exampleSync,
    createdAt: at("2026-06-17T10:00+02:00"),
    labels: ["kind=chore"],
    assignees: [alice],
    ending: {
      outcome: "completed",
      label: "closed as completed",
      at: at("2026-09-23T10:00+02:00"),
      by: alice,
    },
  }),
];

/**
 * Reads a finished thread's details: its stack's members, each merged
 * below it, and open above it, as its details list them.
 */
export async function readWeekDetail(
  thread: ThreadSummary,
): Promise<ThreadDetail> {
  const { stack } = thread;
  const members = stack
    ? Array.from({ length: stack.size }, (_, place) => ({
        position: place + 1,
        number: thread.number - stack.position + place + 1,
        state:
          place + 1 <= stack.position ? ("merged" as const) : ("open" as const),
      }))
    : undefined;
  const { stack: _, ...detail } = parserFixDetail;
  return { ...detail, ...(members && { stack: members }) };
}
