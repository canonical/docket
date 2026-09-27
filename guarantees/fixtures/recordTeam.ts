import type { Recording } from "../types.js";
import {
  bot,
  checkRun,
  comment,
  issueNode,
  noFile,
  noPushes,
  page,
  probe,
  snapshot,
  stackEntry,
  user,
} from "./shapes.js";

/** The text written on GitHub that a recording carries. */
export interface Words {
  readonly title: string;
  readonly comment: string;
  readonly label: string;
  readonly check: string;
  readonly branch: string;
}

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";

/**
 * Two watched repositories on the Monday 28 September 2026: a pull
 * request dave opened from a fork, assigned to alice, with bob asked for
 * a review, failing checks and second in a stack of three; an issue carol
 * opened on Friday; and a documentation issue alice opened and a bot
 * labelled. `words` gives the text written on GitHub.
 */
export default function recordTeam(words: Words): Recording {
  const parserFix = {
    ...issueNode({
      number: 12,
      title: words.title,
      createdAt: "2026-09-21T08:00:00Z",
      updatedAt: "2026-09-28T09:35:00Z",
      author: "dave",
      assignees: ["alice"],
      labels: [words.label],
      comments: [comment("dave", "2026-09-25T07:00:00Z", "NONE")],
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
    stackEntry: stackEntry(2, 3, words.branch),
  };
  const crash = issueNode({
    number: 15,
    title: "Crash on start",
    createdAt: "2026-09-25T14:00:00Z",
    author: "carol",
  });
  const tokens = issueNode({
    number: 4,
    title: "Where do tokens live?",
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-27T18:00:00Z",
    author: "alice",
    association: "MEMBER",
    assignees: ["alice", "bob"],
  });
  const failed = checkRun(words.check, "FAILURE", "2026-09-28T09:35:00Z");
  const opened = (node: { number: number; title: string }, at: string) => ({
    number: node.number,
    title: node.title,
    createdAt: at,
  });
  return {
    [`File ${repo}`]: noFile,
    [`File ${docs}`]: noFile,
    [`GET /repos/${repo}/issues`]: probe("first-example"),
    [`GET /repos/${docs}/issues`]: probe("first-docs"),
    [`GET /repos/${repo}/activity`]: noPushes,
    [`GET /repos/${docs}/activity`]: noPushes,
    [`Snapshot ${repo}`]: snapshot([crash], [parserFix]),
    [`Snapshot ${docs}`]: snapshot([tokens]),
    [`Events ${repo}`]: {
      data: {
        repository: {
          issues: page([
            {
              ...opened(crash, crash.createdAt),
              updatedAt: crash.updatedAt,
              author: user("carol"),
              timelineItems: { nodes: [] },
            },
          ]),
          pullRequests: page([
            {
              ...opened(parserFix, parserFix.createdAt),
              updatedAt: parserFix.updatedAt,
              author: user("dave"),
              headRefName: words.branch,
              isCrossRepository: true,
              stackEntry: parserFix.stackEntry,
              timelineItems: {
                nodes: [
                  {
                    __typename: "IssueComment",
                    author: user("dave"),
                    createdAt: "2026-09-25T07:00:00Z",
                  },
                  {
                    __typename: "ReviewRequestedEvent",
                    actor: user("alice"),
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
          discussions: page([]),
        },
      },
    },
    [`Events ${docs}`]: {
      data: {
        repository: {
          issues: page([
            {
              ...opened(tokens, tokens.createdAt),
              updatedAt: tokens.updatedAt,
              author: user("alice"),
              timelineItems: {
                nodes: [
                  {
                    __typename: "LabeledEvent",
                    actor: bot("example-sync"),
                    createdAt: "2026-09-27T18:00:00Z",
                    label: { name: "kind=docs" },
                  },
                ],
              },
            },
          ]),
          pullRequests: page([]),
          discussions: page([]),
        },
      },
    },
  };
}
