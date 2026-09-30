/**
 * Rows of owed as its view model measures them at `recordedNow`, one for
 * each look a row takes on screen, for the terminal blocks' stories and
 * tests. It imports nothing from vitest.
 */

import type { Repo } from "../lib/config/index.js";
import { listWaits, type WaitRow } from "../lib/owed/index.js";
import type { Wait } from "../lib/waits/index.js";
import {
  alice,
  at,
  bob,
  dave,
  exampleSync,
  teamSettings,
  thread,
  wait,
} from "./facts.js";
import { recordedNow } from "./recorded.js";

const example: Repo = {
  name: "example",
  repo: "example-org/example-repo",
  tags: [],
};

/**
 * Measures one wait in `repo`, `example` unless given, at `recordedNow`,
 * Monday 28 September 2026 at 12:00 in Paris, as owed lists it.
 *
 * @param invalidFile Whether the repository's own file is invalid.
 */
export function measureRow(
  facts: Partial<Wait>,
  invalidFile = false,
  repo: Repo = example,
): WaitRow {
  const { rows } = listWaits(
    [
      {
        repo,
        time: teamSettings.time,
        people: teamSettings.people,
        yours: teamSettings.you.teams,
        waits: [wait(facts)],
        invalidFile,
      },
    ],
    recordedNow,
  );
  const [row] = rows;
  if (!row) throw new Error("one wait makes one row");
  return row;
}

/**
 * A review bob owes on a pull request second in a stack of three, a
 * working day over its target, with its checks failing and one push since
 * the review was asked for.
 */
export const overReview = measureRow({
  thread: thread({
    number: 12,
    kind: "pullRequest",
    title: "Fix the parser",
    stack: { number: 3, position: 2, size: 3, base: "main" },
    checks: "failing",
    pushes: [{ author: dave, at: at("2026-09-25T11:00+02:00") }],
    reviewRequests: [
      { reviewer: bob, requester: alice, at: at("2026-09-25T09:00+02:00") },
    ],
  }),
  kind: "review",
  owners: ["bob"],
  due: at("2026-09-25T12:00+02:00"),
});

/** A reply nobody is assigned to, due in three hours, to dave's message of Sunday. */
export const soonReply = measureRow({
  thread: thread({
    number: 15,
    title: "Crash on start",
    comments: [
      {
        author: dave,
        at: at("2026-09-27T12:00+02:00"),
        text: "It crashes as soon as it starts, before the first frame is drawn.",
      },
    ],
  }),
  kind: "response",
  due: at("2026-09-28T15:00+02:00"),
});

/**
 * The close of a draft pull request alice owns, third in the stack, with
 * eight working days of its fourteen left.
 */
export const draftClose = measureRow({
  thread: thread({
    number: 13,
    kind: "pullRequest",
    title: "Document the parser",
    draft: true,
    stack: { number: 3, position: 3, size: 3, base: "main" },
    assignees: [alice],
  }),
  owners: ["alice"],
  target: { amount: 14, unit: "d" },
  due: at("2026-10-08T12:00+02:00"),
});

/**
 * The close of an issue three people own, one of them with a login longer
 * than a row gives a login, with a label of each shape; bob spoke last,
 * three hours ago.
 */
export const sharedClose = measureRow({
  thread: thread({
    number: 4,
    title: "Where do tokens live?",
    labels: ["priority: high", "kind=bug", "area/icons"],
    updatedAt: at("2026-09-28T09:00+02:00"),
    comments: [{ author: bob, at: at("2026-09-28T09:00+02:00") }],
    assignees: [
      alice,
      bob,
      { login: "carol-at-example-org", type: "user", member: true },
    ],
  }),
  owners: ["alice", "bob", "carol-at-example-org"],
  target: { amount: 30, unit: "d" },
  due: at("2026-09-21T12:00+02:00"),
});

/**
 * A reply dave waits for on an issue with a four-digit number, 22 working
 * hours over: the reference, both kinds and the distance leave too few
 * cells at 40 columns for his login, so he leaves the first line.
 */
export const crowdedReply = measureRow({
  thread: thread({ number: 1240, title: "Token naming for the spacing scale" }),
  kind: "response",
  owners: [],
  due: at("2026-09-25T14:00+02:00"),
});

/**
 * A review a bot asked for on its own pull request, on track: its login
 * is cut to the cells left, and its mark stays whole.
 */
export const botReview = measureRow({
  thread: thread({
    number: 1250,
    kind: "pullRequest",
    title: "Update dependency example-lib to 3.24",
    author: exampleSync,
    reviewRequests: [{ reviewer: bob, at: at("2026-09-28T09:00+02:00") }],
  }),
  kind: "review",
  author: exampleSync,
  owners: ["bob"],
  target: { amount: 3, unit: "d" },
  due: at("2026-09-30T12:00+02:00"),
});
