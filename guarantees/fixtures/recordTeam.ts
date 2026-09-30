import type { Recording, Words } from "../types.js";
import { noFile, noPushes, viewer } from "./constants.js";
import {
  buildBot,
  buildCheckRun,
  buildComment,
  buildIssueNode,
  buildPage,
  buildProbe,
  buildSnapshot,
  buildStackEntry,
  buildUser,
} from "./shapes.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
/**
 * When GitHub last recorded a change to dave's pull request, and to those
 * like it.
 */
const lastChange = "2026-09-28T09:35:00Z";

/**
 * Two watched repositories on the Monday 28 September 2026: a pull
 * request dave opened from a fork, assigned to alice, with bob asked for
 * a review, failing checks and second in a stack of three; a pull request
 * bob opened and alice merged on Sunday; an issue carol opened on Friday;
 * and a documentation issue alice opened and a bot labelled. `words`
 * gives the text written on GitHub, and `tag` the entity tag the check
 * for changes answers with, `crowd` how many more pull requests like
 * dave's wait on bob's review, `changedAt` when GitHub last recorded
 * a change to dave's, and `changedCrowd` the numbers of those like it
 * that changed then too.
 */
export default function recordTeam(
  words: Words,
  tag = "first",
  crowd = 0,
  changedAt = lastChange,
  changedCrowd: readonly number[] = [],
): Recording {
  const parserFix = {
    ...buildIssueNode({
      number: 12,
      url: `https://github.com/${repo}/pull/12`,
      title: words.title,
      createdAt: "2026-09-21T08:00:00Z",
      updatedAt: changedAt,
      author: "dave",
      assignees: ["alice"],
      labels: [words.label],
      comments: [
        buildComment("dave", "2026-09-25T07:00:00Z", "NONE", words.comment),
      ],
    }),
    isDraft: false,
    headRefName: words.branch,
    isCrossRepository: true,
    latestReviews: { nodes: [] },
    requested: {
      nodes: [
        {
          __typename: "ReviewRequestedEvent",
          createdAt: "2026-09-28T07:00:00Z",
          actor: buildUser("alice"),
          requestedReviewer: { __typename: "User", login: "bob" },
        },
      ],
    },
    withdrawn: { nodes: [] },
    commits: {
      nodes: [
        {
          commit: {
            committedDate: "2026-09-24T12:00:00Z",
            author: { user: { login: "dave" } },
            statusCheckRollup: { state: "FAILURE" },
          },
        },
      ],
    },
    stackEntry: buildStackEntry(2, 3, words.branch),
  };
  const crash = buildIssueNode({
    number: 15,
    url: `https://github.com/${repo}/issues/15`,
    title: "Crash on start",
    createdAt: "2026-09-25T14:00:00Z",
    author: "carol",
  });
  const tokens = buildIssueNode({
    number: 4,
    url: `https://github.com/${docs}/issues/4`,
    title: "Where do tokens live?",
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-27T18:00:00Z",
    author: "alice",
    association: "MEMBER",
    assignees: ["alice", "bob"],
  });
  const failed = buildCheckRun(words.check, "FAILURE", "2026-09-28T09:35:00Z");
  const buildOpened = (
    node: { number: number; url: string; title: string },
    at: string,
  ) => ({
    number: node.number,
    url: node.url,
    title: node.title,
    createdAt: at,
  });
  const recording: Recording = {
    Viewer: viewer,
    [`File ${repo}`]: noFile,
    [`File ${docs}`]: noFile,
    [`GET /repos/${repo}/issues`]: buildProbe(`${tag}-example`),
    [`GET /repos/${docs}/issues`]: buildProbe(`${tag}-docs`),
    [`GET /repos/${repo}/activity`]: noPushes,
    [`GET /repos/${docs}/activity`]: noPushes,
    [`Snapshot ${repo}`]: buildSnapshot([crash], [parserFix]),
    [`Snapshot ${docs}`]: buildSnapshot([tokens]),
    [`Events ${repo}`]: {
      data: {
        repository: {
          issues: buildPage([
            {
              ...buildOpened(crash, crash.createdAt),
              updatedAt: crash.updatedAt,
              author: buildUser("carol"),
              timelineItems: { nodes: [] },
            },
          ]),
          pullRequests: buildPage([
            {
              number: 14,
              url: `https://github.com/${repo}/pull/14`,
              title: "Tidy the changelog",
              createdAt: "2026-09-20T08:00:00Z",
              updatedAt: "2026-09-27T13:00:01Z",
              author: buildUser("bob"),
              headRefName: "docs/changelog",
              isCrossRepository: false,
              stackEntry: null,
              // GitHub records the merge and a close with it, here a
              // second apart.
              timelineItems: {
                nodes: [
                  {
                    __typename: "MergedEvent",
                    actor: buildUser("alice"),
                    createdAt: "2026-09-27T13:00:00Z",
                  },
                  {
                    __typename: "ClosedEvent",
                    actor: buildUser("alice"),
                    createdAt: "2026-09-27T13:00:01Z",
                  },
                ],
              },
              commits: { nodes: [{ commit: { oid: "d0c5e1a" } }] },
              head: { nodes: [] },
            },
            {
              ...buildOpened(parserFix, parserFix.createdAt),
              updatedAt: parserFix.updatedAt,
              author: buildUser("dave"),
              headRefName: words.branch,
              isCrossRepository: true,
              stackEntry: parserFix.stackEntry,
              timelineItems: {
                nodes: [
                  {
                    __typename: "IssueComment",
                    author: buildUser("dave"),
                    createdAt: "2026-09-25T07:00:00Z",
                  },
                  {
                    __typename: "ReviewRequestedEvent",
                    actor: buildUser("alice"),
                    createdAt: "2026-09-28T07:00:00Z",
                  },
                ],
              },
              commits: { nodes: [{ commit: { oid: "c0ffee1" } }] },
              head: {
                nodes: [
                  {
                    commit: {
                      committedDate: "2026-09-24T12:00:00Z",
                      author: { user: { login: "dave" } },
                      statusCheckRollup: {
                        state: "FAILURE",
                        contexts: { nodes: [failed] },
                      },
                    },
                  },
                ],
              },
            },
          ]),
          discussions: buildPage([]),
        },
      },
    },
    [`Events ${docs}`]: {
      data: {
        repository: {
          issues: buildPage([
            {
              ...buildOpened(tokens, tokens.createdAt),
              updatedAt: tokens.updatedAt,
              author: buildUser("alice"),
              timelineItems: {
                nodes: [
                  {
                    __typename: "LabeledEvent",
                    actor: buildBot("example-sync"),
                    createdAt: "2026-09-27T18:00:00Z",
                    label: { name: "kind=docs" },
                  },
                ],
              },
            },
          ]),
          pullRequests: buildPage([]),
          discussions: buildPage([]),
        },
      },
    },
    [`Detail ${repo}#12`]: {
      data: {
        repository: {
          pullRequest: {
            createdAt: parserFix.createdAt,
            updatedAt: parserFix.updatedAt,
            labels: parserFix.labels,
            assignees: parserFix.assignees,
            comments: {
              nodes: [
                buildComment(
                  "dave",
                  "2026-09-25T07:00:00Z",
                  "NONE",
                  words.comment,
                ),
              ],
            },
            reviews: {
              nodes: [
                {
                  ...buildComment(
                    "bob",
                    "2026-09-24T13:00:00Z",
                    "MEMBER",
                    "Looks close.",
                  ),
                  submittedAt: "2026-09-24T13:00:00Z",
                },
              ],
            },
            timelineItems: {
              nodes: [
                {
                  createdAt: "2026-09-28T07:00:00Z",
                  actor: buildUser("alice"),
                  requestedReviewer: { __typename: "User", login: "bob" },
                },
              ],
            },
            files: {
              nodes: [{ path: "src/parser.ts", additions: 40, deletions: 12 }],
            },
            commits: {
              nodes: [
                {
                  commit: {
                    statusCheckRollup: { contexts: { nodes: [failed] } },
                  },
                },
              ],
            },
            stack: {
              entries: {
                nodes: [
                  { position: 1, pullRequest: { number: 11, state: "MERGED" } },
                  { position: 2, pullRequest: { number: 12, state: "OPEN" } },
                  { position: 3, pullRequest: { number: 13, state: "OPEN" } },
                ],
              },
            },
          },
        },
      },
    },
  };
  // Pull requests like the parser fix, numbered from 100, so a pane
  // scrolled through them reads a full window of details in one request.
  const crowded = Array.from({ length: crowd }, (_, index) => {
    const number = 100 + index;
    return {
      ...parserFix,
      number,
      updatedAt: changedCrowd.includes(number) ? changedAt : lastChange,
      url: `https://github.com/${repo}/pull/${number}`,
      title: `${words.title} ${number}`,
    };
  });
  return {
    ...recording,
    [`Snapshot ${repo}`]: buildSnapshot([crash], [parserFix, ...crowded]),
    ...Object.fromEntries(
      crowded.map(({ number }) => [
        `Detail ${repo}#${number}`,
        recording[`Detail ${repo}#12`],
      ]),
    ),
  };
}
