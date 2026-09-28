import type { Cursor, PageProgress, Snapshot } from "../provider/index.js";
import type { Push, Thread } from "../waits/index.js";
import {
  fullPageSize,
  incrementalPageSize,
  watermarkMargin,
} from "./constants.js";
import fetchLists from "./fetchLists.js";
import fetchPushes from "./fetchPushes.js";
import fragments from "./fragments.js";
import readAccount from "./readAccount.js";
import readDiscussion from "./readDiscussion.js";
import readIssue from "./readIssue.js";
import readPullRequest from "./readPullRequest.js";
import readReviewer from "./readReviewer.js";
import splitRepo from "./splitRepo.js";
import type { Client, DiscussionNode, IssueNode, PullNode } from "./types.js";

const { account, written, requestedReviewer, stackEntry, pageInfo, order } =
  fragments;
const thread = `number title createdAt updatedAt state ${written}
  assignees(first: 10) { nodes { ${account} } }
  labels(first: 10) { nodes { name } }
  comments(last: 3) { nodes { ${written} createdAt } }`;

// The latest requests and the latest withdrawals, twenty of each, read as
// two lists: read as one, a run of withdrawals would push a request that
// still stands out of the twenty.
const requests = `requested: timelineItems(last: 20, itemTypes: [REVIEW_REQUESTED_EVENT]) {
    nodes { __typename ... on ReviewRequestedEvent { createdAt ${requestedReviewer} } }
  }
  withdrawn: timelineItems(last: 20, itemTypes: [REVIEW_REQUEST_REMOVED_EVENT]) {
    nodes { __typename ... on ReviewRequestRemovedEvent { createdAt ${requestedReviewer} } }
  }`;

const document = `query Snapshot($owner: String!, $name: String!, $size: Int!,
  $since: DateTime, $issueStates: [IssueState!], $pullStates: [PullRequestState!],
  $discussionStates: [DiscussionState!], $issuesAfter: String, $pullsAfter: String,
  $discussionsAfter: String, $withIssues: Boolean!, $withPulls: Boolean!,
  $withDiscussions: Boolean!) {
  ${fragments.rateLimit}
  repository(owner: $owner, name: $name) {
    issues(first: $size, after: $issuesAfter, states: $issueStates,
      filterBy: { since: $since }, ${order}) @include(if: $withIssues) {
      ${pageInfo} totalCount
      nodes { ${thread} }
    }
    pullRequests(first: $size, after: $pullsAfter, states: $pullStates, ${order})
      @include(if: $withPulls) {
      ${pageInfo} totalCount
      nodes {
        ${thread}
        isDraft headRefName isCrossRepository
        latestReviews(first: 10) { nodes { ${written} submittedAt } }
        ${requests}
        commits(last: 1) {
          nodes { commit { committedDate author { user { login } } statusCheckRollup { state } } }
        }
        ${stackEntry}
      }
    }
    discussions(first: $size, after: $discussionsAfter, states: $discussionStates, ${order})
      @include(if: $withDiscussions) {
      ${pageInfo} totalCount
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

/**
 * Reads the three lists: with `since`, every thread updated since it in
 * any state, so a thread that closed or merged replaces its open copy;
 * without, only the open threads. Issues are filtered by GitHub itself.
 */
function readLists(
  client: Client,
  repo: string,
  since: string | undefined,
  onPage: ((progress: PageProgress) => void) | undefined,
) {
  const open = since === undefined;
  return fetchLists<IssueNode, PullNode, DiscussionNode>(
    client,
    document,
    {
      ...splitRepo(repo),
      size: open ? fullPageSize : incrementalPageSize,
      since: since ?? null,
      issueStates: open ? ["OPEN"] : ["OPEN", "CLOSED"],
      pullStates: open ? ["OPEN"] : ["OPEN", "CLOSED", "MERGED"],
      discussionStates: open ? ["OPEN"] : ["OPEN", "CLOSED"],
    },
    since === undefined ? undefined : new Date(since),
    onPage,
  );
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
 * @param teamMembers Gives the logins of a team named `organisation/team`.
 * @param onPage Hears of each page of the lists as it arrives.
 */
export default async function fetchSnapshot(
  client: Client,
  repo: string,
  cursor: Cursor | null,
  teamMembers: (team: string) => Promise<readonly string[]>,
  onPage?: (progress: PageProgress) => void,
): Promise<Snapshot> {
  const lists = await readLists(client, repo, cursor?.since, onPage);
  const open = lists.pullRequests.filter(({ state }) => state === "OPEN");
  const teams = new Set(
    open.flatMap(({ requested }) =>
      requested.nodes.flatMap(({ requestedReviewer }) => {
        const found = readReviewer(requestedReviewer);
        return found && "team" in found ? [found.team] : [];
      }),
    ),
  );
  const members = new Map<string, readonly string[]>();
  for (const team of teams) {
    members.set(team, await teamMembers(team));
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
