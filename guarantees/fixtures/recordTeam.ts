import type { Recording, Words } from "../types.js";
import { noFile, noPushes } from "./constants.js";
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
 * Two watched repositories on the Monday 28 September 2026: a pull
 * request dave opened from a fork, assigned to alice, with bob asked for
 * a review, failing checks and second in a stack of three; an issue carol
 * opened on Friday; and a documentation issue alice opened and a bot
 * labelled. `words` gives the text written on GitHub, and `tag` the
 * entity tag the check for changes answers with.
 */
export default function recordTeam(words: Words, tag = "first"): Recording {
  const parserFix = {
    ...buildIssueNode({
      number: 12,
      title: words.title,
      createdAt: "2026-09-21T08:00:00Z",
      updatedAt: "2026-09-28T09:35:00Z",
      author: "dave",
      assignees: ["alice"],
      labels: [words.label],
      comments: [buildComment("dave", "2026-09-25T07:00:00Z", "NONE")],
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
    title: "Crash on start",
    createdAt: "2026-09-25T14:00:00Z",
    author: "carol",
  });
  const tokens = buildIssueNode({
    number: 4,
    title: "Where do tokens live?",
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-27T18:00:00Z",
    author: "alice",
    association: "MEMBER",
    assignees: ["alice", "bob"],
  });
  const failed = buildCheckRun(words.check, "FAILURE", "2026-09-28T09:35:00Z");
  const buildOpened = (
    node: { number: number; title: string },
    at: string,
  ) => ({
    number: node.number,
    title: node.title,
    createdAt: at,
  });
  return {
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
            updatedAt: parserFix.updatedAt,
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
}
