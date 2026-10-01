/**
 * Text longer than any slot gives it, for each terminal block's `Long`
 * story: a repository with a long short name, a login and a team's name
 * past a row's room, a long title, long check names and a long base
 * branch. It imports nothing from vitest.
 */

import { type EventLine, listEvents } from "../lib/activity/index.js";
import type { Repo } from "../lib/config/index.js";
import type { WaitRow } from "../lib/owed/index.js";
import type { Author } from "../lib/people/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import { activityNow } from "./activity.js";
import { alice, at, bob, teamSettings, thread } from "./facts.js";
import { measureRow } from "./rows.js";

/** A watched repository whose short name is longer than a login's room. */
export const longRepo: Repo = {
  name: "example-repository-with-a-long-name",
  repo: "example-org/example-repository-with-a-long-name",
  tags: [],
};

/** Someone outside the organisation, with a login past a row's 12 cells. */
export const longAuthor: Author = {
  login: "example-contributor-with-a-long-login",
  type: "user",
  member: false,
};

/** A team of the organisation, which a row names without its organisation. */
export const parserTeam = "example-org/parser-team";

const longThread = thread({
  repo: longRepo.repo,
  number: 12345,
  kind: "pullRequest",
  title:
    "Keep the comments at the ends of lines when the parser meets a heredoc",
  author: longAuthor,
  draft: true,
  checks: "failing",
  stack: {
    number: 7,
    position: 2,
    size: 3,
    base: "release/example-branch-with-a-long-name",
  },
  reviewRequests: [
    {
      reviewer: { team: parserTeam, members: [] },
      requester: longAuthor,
      at: at("2026-09-25T09:00+02:00"),
    },
  ],
});

/**
 * A review the parser team owes on a draft pull request in a stack, a
 * working day over, its checks failing, in a repository whose own file
 * is invalid: every part of a row at once.
 */
export const longReview: WaitRow = measureRow(
  {
    thread: longThread,
    kind: "review",
    author: longAuthor,
    owners: [parserTeam],
    due: at("2026-09-25T12:00+02:00"),
  },
  true,
  longRepo,
);

/** The same review owed by the long-named contributor and the parser team. */
export const longSharedReview: WaitRow = measureRow(
  {
    thread: {
      ...longThread,
      reviewRequests: [
        ...longThread.reviewRequests,
        { reviewer: longAuthor, requester: alice, at: longThread.createdAt },
      ],
    },
    kind: "review",
    author: bob,
    owners: [longAuthor.login, parserTeam],
    due: at("2026-09-25T12:00+02:00"),
  },
  false,
  longRepo,
);

/** The details of the long review: three checks with long names failing. */
export const longReviewDetail: ThreadDetail = {
  createdAt: at("2026-09-22T10:00+02:00"),
  updatedAt: at("2026-09-28T11:35+02:00"),
  labels: [],
  assignees: [],
  messages: [],
  requests: [],
  files: [{ path: "src/parser.ts", additions: 40, deletions: 12 }],
  checks: [
    { name: "lint the whole repository", state: "failing" },
    { name: "unit tests on every platform", state: "failing" },
    { name: "build the documentation site", state: "failing" },
    { name: "test", state: "passing" },
  ],
  stack: [
    { position: 1, number: 12344, state: "merged" },
    { position: 2, number: 12345, state: "open" },
    { position: 3, number: 12346, state: "open" },
  ],
};

/**
 * The long-named contributor labelled the long review's pull request with
 * a long label, as activity lists it.
 */
export const longEvent: EventLine = (() => {
  const [row] = listEvents(
    [
      {
        repo: longRepo,
        people: teamSettings.people,
        threads: [longThread],
        events: [
          {
            thread: longThread,
            kind: "labelled",
            label: "priority: needs-a-decision-from-the-maintainers",
            actor: longAuthor,
            at: at("2026-09-28T07:00+02:00"),
            bot: false,
          },
        ],
      },
    ],
    activityNow,
  ).rows;
  const [line] = row?.events ?? [];
  if (!line) throw new Error("one event makes one line");
  return line;
})();
