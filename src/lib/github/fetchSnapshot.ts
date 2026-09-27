import type { Cursor, Snapshot } from "../provider/index.js";
import type { Push, Thread } from "../waits/index.js";
import {
  fullPageSize,
  incrementalPageSize,
  watermarkMargin,
} from "./constants.js";
import fetchPushes from "./fetchPushes.js";
import listTeamMembers from "./listTeamMembers.js";
import readAccount from "./readAccount.js";
import readDiscussion from "./readDiscussion.js";
import readIssue from "./readIssue.js";
import readPullRequest from "./readPullRequest.js";
import readReviewer from "./readReviewer.js";
import splitRepo from "./splitRepo.js";
import type {
  Client,
  DiscussionNode,
  IssueNode,
  PageNode,
  PullNode,
} from "./types.js";

const account = "login __typename";
const written = `author { ${account} } authorAssociation`;
const thread = `number title createdAt updatedAt state ${written}
  assignees(first: 10) { nodes { ${account} } }
  labels(first: 10) { nodes { name } }
  comments(last: 3) { nodes { ${written} createdAt } }`;
const reviewer = `requestedReviewer { __typename ... on User { login } ... on Bot { login } ... on Team { combinedSlug } }`;
const order = "orderBy: { field: UPDATED_AT, direction: DESC }";
const pageInfo = "pageInfo { hasNextPage endCursor }";

const document = `query Snapshot($owner: String!, $name: String!, $size: Int!,
  $since: DateTime, $issueStates: [IssueState!], $pullStates: [PullRequestState!],
  $discussionStates: [DiscussionState!], $issuesAfter: String, $pullsAfter: String,
  $discussionsAfter: String, $withIssues: Boolean!, $withPulls: Boolean!,
  $withDiscussions: Boolean!) {
  rateLimit { limit remaining resetAt }
  repository(owner: $owner, name: $name) {
    issues(first: $size, after: $issuesAfter, states: $issueStates,
      filterBy: { since: $since }, ${order}) @include(if: $withIssues) {
      ${pageInfo}
      nodes { ${thread} }
    }
    pullRequests(first: $size, after: $pullsAfter, states: $pullStates, ${order})
      @include(if: $withPulls) {
      ${pageInfo}
      nodes {
        ${thread}
        isDraft headRefName isCrossRepository
        latestReviews(first: 10) { nodes { ${written} submittedAt } }
        timelineItems(last: 20, itemTypes: [REVIEW_REQUESTED_EVENT, REVIEW_REQUEST_REMOVED_EVENT]) {
          nodes {
            __typename
            ... on ReviewRequestedEvent { createdAt ${reviewer} }
            ... on ReviewRequestRemovedEvent { createdAt ${reviewer} }
          }
        }
        commits(last: 1) {
          nodes { commit { committedDate author { user { login } } statusCheckRollup { state } } }
        }
        stackEntry { position stack { number size baseRefName } }
      }
    }
    discussions(first: $size, after: $discussionsAfter, states: $discussionStates, ${order})
      @include(if: $withDiscussions) {
      ${pageInfo}
      nodes {
        number title createdAt updatedAt closed ${written}
        labels(first: 10) { nodes { name } }
        comments(last: 3) {
          nodes { ${written} createdAt replies(last: 1) { nodes { ${written} createdAt } } }
        }
      }
    }
  }
}`;

interface Answer {
  readonly repository: {
    readonly issues?: PageNode<IssueNode>;
    readonly pullRequests?: PageNode<PullNode>;
    readonly discussions?: PageNode<DiscussionNode>;
  };
}

type Kind = "issues" | "pullRequests" | "discussions";

/** A GraphQL list read page by page, and whether it has more to read. */
interface Reading {
  after: string | null;
  done: boolean;
}

const newest = (a: { updatedAt: string }, b: { updatedAt: string }) =>
  Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;

/**
 * Reads every page of the three lists, keeping each thread once, in its
 * latest version. A list ordered by update can shift while it is read,
 * so a thread may come twice. With `since`, the pull requests and
 * discussions stop at the first thread updated before it; issues are
 * filtered by GitHub itself.
 */
async function readLists(
  client: Client,
  repo: string,
  since: string | undefined,
) {
  const { owner, name } = splitRepo(repo);
  const found = {
    issues: new Map<number, IssueNode>(),
    pullRequests: new Map<number, PullNode>(),
    discussions: new Map<number, DiscussionNode>(),
  };
  const reading: Record<Kind, Reading> = {
    issues: { after: null, done: false },
    pullRequests: { after: null, done: false },
    discussions: { after: null, done: false },
  };
  // A full snapshot needs only open threads. An incremental one reads
  // every state, so a thread that closed or merged replaces its open copy.
  const open = since === undefined;
  while (Object.values(reading).some(({ done }) => !done)) {
    const { repository } = await client.query<Answer>(document, {
      owner,
      name,
      size: open ? fullPageSize : incrementalPageSize,
      since: since ?? null,
      issueStates: open ? ["OPEN"] : ["OPEN", "CLOSED"],
      pullStates: open ? ["OPEN"] : ["OPEN", "CLOSED", "MERGED"],
      discussionStates: open ? ["OPEN"] : ["OPEN", "CLOSED"],
      issuesAfter: reading.issues.after,
      pullsAfter: reading.pullRequests.after,
      discussionsAfter: reading.discussions.after,
      withIssues: !reading.issues.done,
      withPulls: !reading.pullRequests.done,
      withDiscussions: !reading.discussions.done,
    });
    for (const kind of ["issues", "pullRequests", "discussions"] as const) {
      const list = repository[kind];
      if (!list) continue;
      const map = found[kind] as Map<number, { updatedAt: string }>;
      let stale = false;
      for (const node of list.nodes) {
        if (
          since !== undefined &&
          Date.parse(node.updatedAt) < Date.parse(since)
        ) {
          stale = true;
          continue;
        }
        const seen = map.get(node.number);
        map.set(node.number, seen ? newest(seen, node) : node);
      }
      const { hasNextPage, endCursor } = list.pageInfo;
      reading[kind] = { after: endCursor, done: stale || !hasNextPage };
    }
  }
  return {
    issues: [...found.issues.values()],
    pullRequests: [...found.pullRequests.values()],
    discussions: [...found.discussions.values()],
  };
}

/**
 * Finds the pushes to an open pull request that a review wait can read:
 * those after its earliest review. A pull request from a fork has no
 * pushes in the repository's activity feed, so its head commit stands in
 * for its latest push, dated by the commit and made by the account the
 * commit's author is linked to.
 */
async function findPushes(
  client: Client,
  repo: string,
  node: PullNode,
): Promise<Push[]> {
  if (node.isCrossRepository) {
    const head = node.commits.nodes.at(-1)?.commit;
    const login = head?.author?.user?.login;
    if (!head || !login) return [];
    return [
      {
        author: { login, type: "user" },
        at: new Date(head.committedDate),
      },
    ];
  }
  const reviewed = node.latestReviews.nodes
    .flatMap(({ submittedAt }) => (submittedAt ? [submittedAt] : []))
    .sort()
    .at(0);
  if (!reviewed) return [];
  const pushes = await fetchPushes(
    client,
    repo,
    new Date(reviewed),
    `refs/heads/${node.headRefName}`,
  );
  return pushes.map(({ actor, at }) => ({ author: readAccount(actor), at }));
}

/**
 * Fetches the threads of `repo` changed since `cursor`, or every open
 * thread when it is `null`, with the pushes and team members their waits
 * read.
 *
 * The next cursor starts a margin before the newest update seen, which
 * is GitHub's clock, never the reader's. A snapshot that sees no thread
 * keeps the cursor it was given.
 *
 * @note Impure: reads from GitHub.
 */
export default async function fetchSnapshot(
  client: Client,
  repo: string,
  cursor: Cursor | null,
): Promise<Snapshot> {
  const lists = await readLists(client, repo, cursor?.since);
  const open = lists.pullRequests.filter(({ state }) => state === "OPEN");
  const teams = new Set(
    open.flatMap(({ timelineItems }) =>
      timelineItems.nodes.flatMap(({ requestedReviewer }) => {
        const found = readReviewer(requestedReviewer);
        return found && "team" in found ? [found.team] : [];
      }),
    ),
  );
  const members = new Map<string, readonly string[]>();
  for (const team of teams) {
    members.set(team, await listTeamMembers(client, team));
  }
  const pulls: Thread[] = [];
  for (const node of lists.pullRequests) {
    const pushes =
      node.state === "OPEN" ? await findPushes(client, repo, node) : [];
    pulls.push(readPullRequest(repo, node, pushes, members));
  }
  const threads = [
    ...lists.issues.map((node) => readIssue(repo, node)),
    ...pulls,
    ...lists.discussions.map((node) => readDiscussion(repo, node)),
  ];
  const latest = [...lists.issues, ...lists.pullRequests, ...lists.discussions]
    .map(({ updatedAt }) => Date.parse(updatedAt))
    .reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
  return {
    threads,
    cursor: Number.isFinite(latest)
      ? { since: new Date(latest - watermarkMargin).toISOString() }
      : cursor,
  };
}
