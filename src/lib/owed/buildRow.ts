import {
  hourMilliseconds,
  measureDuration,
  type WorkingClock,
} from "../clock/index.js";
import type { People } from "../config/index.js";
import type { Message, Wait } from "../waits/index.js";
import { threadWords, waitWords } from "./constants.js";
import describeOwners from "./describeOwners.js";
import describePerson from "./describePerson.js";
import describeTeam from "./describeTeam.js";
import measureDistance from "./measureDistance.js";
import type { Owner, WaitRow } from "./types.js";

/**
 * Builds the row for one running wait.
 *
 * @param repo The short name of the wait's repository, as references write it.
 * @param time The working clock of the wait's repository.
 * @param people The people of the repository's settings, which give each
 * login its group.
 * @param yours The teams the personal file names as the viewer's.
 * @param viewer The login gh is signed in with, when it is known.
 */
export default function buildRow(
  wait: Wait,
  repo: string,
  time: WorkingClock,
  now: Date,
  people: People,
  yours: readonly string[],
  viewer?: string,
): WaitRow {
  const { thread } = wait;
  const { state, overdue, text } = measureDistance(wait, time, now);
  // An owner is an assignee or a requested reviewer, a person or a team.
  const owned = [
    ...thread.assignees,
    ...thread.reviewRequests.map(({ reviewer }) => reviewer),
  ];
  const owners = wait.owners.map((login): Owner => {
    const key = login.toLowerCase();
    const found = owned.find(
      (each) => ("team" in each ? each.team : each.login).toLowerCase() === key,
    );
    if (!found) return { text: login, kind: "person" };
    return "team" in found
      ? describeTeam(found, viewer, yours)
      : describePerson(found, people, viewer);
  });
  const [first] = wait.owners;
  const asked =
    wait.kind === "review"
      ? (thread.reviewRequests.find(
          ({ reviewer }) =>
            ("team" in reviewer ? reviewer.team : reviewer.login) === first,
        ) ?? thread.reviewRequests.at(-1))
      : undefined;
  const latest = [...thread.comments, ...thread.reviews].reduce<
    Message | undefined
  >(
    (newest, message) => (newest && newest.at >= message.at ? newest : message),
    undefined,
  );
  return {
    wait,
    repo,
    state,
    overdue,
    targetHours: measureDuration(wait.target, time) / hourMilliseconds,
    stacked: thread.stack !== undefined,
    reference: { text: `${repo}#${thread.number}`, kind: "identifier" },
    threadKind: { text: threadWords[thread.kind], kind: "words" },
    kind: { text: waitWords[wait.kind], kind: "words" },
    distance: { text, kind: "figure" },
    title: { text: thread.title, kind: "title" },
    author: describePerson(wait.author, people, viewer),
    ...(asked?.requester
      ? { requester: describePerson(asked.requester, people, viewer) }
      : {}),
    // A thread nobody has written on since it opened was last acted on
    // by whoever opened it.
    lastActor: describePerson(latest?.author ?? thread.author, people, viewer),
    ...(thread.draft ? { draft: { text: "draft", kind: "words" } } : {}),
    ...describeOwners(owners),
  };
}
