import {
  hourMilliseconds,
  measureDuration,
  type WorkingClock,
} from "../clock/index.js";
import type { Account, Author } from "../people/index.js";
import type { Wait } from "../waits/index.js";
import { waitWords } from "./constants.js";
import describeOwners from "./describeOwners.js";
import measureDistance from "./measureDistance.js";
import type { Owner, Person, WaitRow } from "./types.js";

/**
 * Builds the row for one running wait.
 *
 * @param repo The short name of the wait's repository, as references write it.
 * @param time The working clock of the wait's repository.
 * @param describe Names an account as the row shows a person.
 */
export default function buildRow(
  wait: Wait,
  repo: string,
  time: WorkingClock,
  now: Date,
  describe: (account: Account | Author) => Person,
): WaitRow {
  const { thread } = wait;
  const { state, overdue, text } = measureDistance(wait, time, now);
  // An owner is an assignee or a requested reviewer. A team is neither a
  // login nor in a group, so it stays text.
  const accounts = [
    ...thread.assignees,
    ...thread.reviewRequests.flatMap(({ reviewer }) =>
      "login" in reviewer ? [reviewer] : [],
    ),
  ];
  const owners = wait.owners.map((login): Owner => {
    const key = login.toLowerCase();
    const account = accounts.find((each) => each.login.toLowerCase() === key);
    return account ? describe(account) : { text: login, fit: "trimmed" };
  });
  return {
    wait,
    repo,
    state,
    overdue,
    targetHours: measureDuration(wait.target, time) / hourMilliseconds,
    stacked: thread.stack !== undefined,
    reference: { text: `${repo}#${thread.number}`, fit: "trimmed" },
    kind: { text: waitWords[wait.kind], fit: "trimmed" },
    distance: { text, fit: "trimmed" },
    title: { text: thread.title, fit: "trimmed" },
    author: describe(wait.author),
    ...(thread.draft ? { draft: { text: "draft", fit: "trimmed" } } : {}),
    ...describeOwners(owners),
  };
}
