/**
 * activity's rows and event lines for the terminal's blocks, built by the
 * view model from a few recorded events, so a block is drawn from what
 * the list really gives it. It imports nothing from vitest.
 */

import {
  type EventLine,
  listEvents,
  type ThreadRow,
} from "../lib/activity/index.js";
import type { WindowEvent } from "../lib/events/index.js";
import { alice, at, bob, exampleSync, teamSettings, thread } from "./facts.js";

/** Monday 28 September 2026, 10:00 in Paris. */
export const activityNow = at("2026-09-28T10:00+02:00");

/** A pull request alice owns, second in a stack of three. */
const parserFix = thread({
  number: 12,
  kind: "pullRequest",
  title: "Fix the parser",
  stack: { number: 3, position: 2, size: 3, base: "main" },
  assignees: [alice],
});

/** A draft pull request example-sync opened, which nobody owns. */
const bump = thread({
  number: 14,
  kind: "pullRequest",
  title: "Update dependency example-lib to 2.0",
  draft: true,
});

/** A documentation issue in a repository whose own file is invalid. */
const tokensGuide = thread({
  repo: "example-org/example-docs",
  number: 4,
  title: "Where do tokens live?",
  assignees: [bob],
});

/** An issue alice and bob both own. */
const crash = thread({
  number: 15,
  title: "Crash on start",
  assignees: [alice, bob],
});

const events: WindowEvent[] = [
  {
    thread: parserFix,
    kind: "checksFailed",
    checks: ["lint"],
    actor: exampleSync,
    at: at("2026-09-28T09:40+02:00"),
    bot: true,
  },
  {
    thread: parserFix,
    kind: "pushed",
    commits: 2,
    actor: alice,
    at: at("2026-09-28T09:35+02:00"),
    bot: false,
  },
  {
    thread: bump,
    kind: "opened",
    actor: exampleSync,
    at: at("2026-09-28T07:00+02:00"),
    bot: true,
  },
  {
    thread: crash,
    kind: "commented",
    actor: bob,
    at: at("2026-09-27T09:00+02:00"),
    bot: false,
  },
];

/**
 * The rows, newest first: the pull request, the draft, the issue, then
 * the documentation issue.
 */
export const activityRows: readonly ThreadRow[] = listEvents(
  [
    {
      repo: { name: "example", repo: "example-org/example-repo", tags: [] },
      people: teamSettings.people,
      threads: [parserFix, bump, crash],
      events,
    },
    {
      repo: { name: "docs", repo: "example-org/example-docs", tags: [] },
      people: teamSettings.people,
      threads: [tokensGuide],
      events: [
        {
          thread: tokensGuide,
          kind: "commented",
          actor: alice,
          at: at("2026-09-26T09:00+02:00"),
          bot: false,
        },
      ],
      invalidFile: true,
    },
  ],
  activityNow,
).rows;

/** The row of the thread numbered `number`. */
export function findActivityRow(number: number): ThreadRow {
  const row = activityRows.find(({ thread: { number: n } }) => n === number);
  if (!row) throw new Error(`no row for #${number}`);
  return row;
}

/** The event line at `index` under the thread numbered `number`. */
export function findEventLine(number: number, index: number): EventLine {
  const line = findActivityRow(number).events.at(index);
  if (!line) throw new Error(`no event ${index} under #${number}`);
  return line;
}
