/**
 * Rows of owed as its view model measures them at `recordedNow`, one for
 * each look a row takes on screen, for the terminal blocks' stories and
 * tests. It imports nothing from vitest.
 */

import type { Repo } from "../lib/config/index.js";
import { listWaits, type WaitRow } from "../lib/owed/index.js";
import type { Wait } from "../lib/waits/index.js";
import { at, teamSettings, thread, wait } from "./facts.js";
import { recordedNow } from "./recorded.js";

const example: Repo = {
  name: "example",
  repo: "example-org/example-repo",
  tags: [],
};

/**
 * Measures one wait in `example` at `recordedNow`, Monday 28 September
 * 2026 at 12:00 in Paris, as owed lists it.
 *
 * @param invalidFile Whether `example`'s own file is invalid.
 */
export function measureRow(facts: Partial<Wait>, invalidFile = false): WaitRow {
  const { rows } = listWaits(
    [
      {
        repo: example,
        time: teamSettings.time,
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
 * working day over its target, with its checks failing.
 */
export const overReview = measureRow({
  thread: thread({
    number: 12,
    kind: "pullRequest",
    title: "Fix the parser",
    stack: { number: 3, position: 2, size: 3, base: "main" },
    checks: "failing",
  }),
  kind: "review",
  owners: ["bob"],
  due: at("2026-09-25T12:00+02:00"),
});

/** A reply nobody is assigned to, due in three hours. */
export const soonReply = measureRow({
  thread: thread({ number: 15, title: "Crash on start" }),
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
  }),
  owners: ["alice"],
  target: { amount: 14, unit: "d" },
  due: at("2026-10-08T12:00+02:00"),
});

/**
 * The close of an issue three people own, one of them with a login longer
 * than a row gives a login.
 */
export const sharedClose = measureRow({
  thread: thread({ number: 4, title: "Where do tokens live?" }),
  owners: ["alice", "bob", "carol-at-example-org"],
  target: { amount: 30, unit: "d" },
  due: at("2026-09-21T12:00+02:00"),
});
