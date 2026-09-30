import type { ThreadEvent } from "../events/index.js";
import type { Account } from "../people/index.js";
import type { ThreadKind, ThreadSummary } from "../waits/index.js";
import { endingLabels } from "./constants.js";
import countCommits from "./countCommits.js";
import dropMergeCloses from "./dropMergeCloses.js";
import fetchLists from "./fetchLists.js";
import fetchPushes from "./fetchPushes.js";
import fragments from "./fragments.js";
import readAccount from "./readAccount.js";
import readCheck from "./readCheck.js";
import readOutcome from "./readOutcome.js";
import readStackEntry from "./readStackEntry.js";
import splitRepo from "./splitRepo.js";
import type {
  ActorNode,
  CheckNode,
  Client,
  FeedPush,
  HeadCommitNode,
  StackEntryNode,
} from "./types.js";

const { account, check, stackEntry, pageInfo, order } = fragments;
const actor = `actor { ${account} } createdAt`;
const issueItems = `__typename
  ... on IssueComment { author { ${account} } createdAt }
  ... on ClosedEvent { ${actor} stateReason }
  ... on ReopenedEvent { ${actor} }
  ... on AssignedEvent { ${actor} assignee { ... on User { login } ... on Bot { login } } }
  ... on LabeledEvent { ${actor} label { name } }`;
const pullItems = `${issueItems}
  ... on PullRequestReview { author { ${account} } submittedAt }
  ... on ReviewRequestedEvent { ${actor} }
  ... on MergedEvent { ${actor} }`;
const issueTypes =
  "ISSUE_COMMENT, CLOSED_EVENT, REOPENED_EVENT, ASSIGNED_EVENT, LABELED_EVENT";
const opened = `number url title createdAt updatedAt author { ${account} }`;

const document = `query Events($owner: String!, $name: String!, $since: DateTime!,
  $issuesAfter: String, $pullsAfter: String, $discussionsAfter: String,
  $withIssues: Boolean!, $withPulls: Boolean!, $withDiscussions: Boolean!) {
  ${fragments.rateLimit}
  repository(owner: $owner, name: $name) {
    issues(first: 50, after: $issuesAfter, filterBy: { since: $since }, ${order})
      @include(if: $withIssues) {
      ${pageInfo}
      nodes {
        ${opened}
        timelineItems(since: $since, first: 100, itemTypes: [${issueTypes}]) { nodes { ${issueItems} } }
      }
    }
    pullRequests(first: 50, after: $pullsAfter, ${order}) @include(if: $withPulls) {
      ${pageInfo}
      nodes {
        ${opened} headRefName isCrossRepository
        ${stackEntry}
        timelineItems(since: $since, first: 100, itemTypes: [${issueTypes},
          PULL_REQUEST_REVIEW, REVIEW_REQUESTED_EVENT, MERGED_EVENT]) { nodes { ${pullItems} } }
        commits(last: 100) { nodes { commit { oid } } }
        head: commits(last: 1) {
          nodes {
            commit {
              committedDate author { user { login } }
              statusCheckRollup { state contexts(first: 50) { nodes { ${check} } } }
            }
          }
        }
      }
    }
    discussions(first: 50, after: $discussionsAfter, ${order}) @include(if: $withDiscussions) {
      ${pageInfo}
      nodes { ${opened} comments(last: 100) { nodes { author { ${account} } createdAt } } }
    }
  }
}`;

/** An item of a thread's timeline; each kind carries some of these. */
interface ItemNode {
  readonly __typename: string;
  readonly author?: ActorNode;
  readonly actor?: ActorNode;
  readonly createdAt?: string;
  readonly submittedAt?: string | null;
  readonly stateReason?: string | null;
  readonly assignee?: { readonly login?: string } | null;
  readonly label?: { readonly name: string } | null;
}

interface OpenedNode {
  readonly number: number;
  readonly url: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: ActorNode;
}

interface IssueEventsNode extends OpenedNode {
  readonly timelineItems: { readonly nodes: readonly ItemNode[] };
}

interface PullEventsNode extends IssueEventsNode {
  readonly headRefName: string;
  readonly isCrossRepository: boolean;
  readonly stackEntry: StackEntryNode;
  readonly commits: {
    readonly nodes: readonly { readonly commit: { readonly oid: string } }[];
  };
  readonly head: {
    readonly nodes: readonly {
      readonly commit: Omit<HeadCommitNode, "statusCheckRollup"> & {
        readonly statusCheckRollup: {
          readonly state: string;
          readonly contexts: { readonly nodes: readonly CheckNode[] };
        } | null;
      };
    }[];
  };
}

interface DiscussionEventsNode extends OpenedNode {
  readonly comments: {
    readonly nodes: readonly {
      readonly author: ActorNode;
      readonly createdAt: string;
    }[];
  };
}

/** Reads the three lists of threads updated at or after `since`. */
const readThreads = (client: Client, repo: string, since: Date) =>
  fetchLists<IssueEventsNode, PullEventsNode, DiscussionEventsNode>(
    client,
    document,
    { ...splitRepo(repo), since: since.toISOString() },
    since,
  );

/** Reads the events one timeline item records. */
function readItem(
  thread: ThreadSummary,
  item: ItemNode,
): ThreadEvent | undefined {
  const at = new Date(item.submittedAt ?? item.createdAt ?? 0);
  const facts = {
    thread,
    actor: readAccount(item.actor ?? item.author ?? null),
    at,
  };
  switch (item.__typename) {
    case "IssueComment":
      return { ...facts, kind: "commented" };
    case "PullRequestReview":
      // A review GitHub has not submitted yet is seen by its writer alone.
      return item.submittedAt ? { ...facts, kind: "reviewed" } : undefined;
    case "ReviewRequestedEvent":
      return { ...facts, kind: "reviewRequested" };
    case "ClosedEvent": {
      const outcome = readOutcome(thread.kind, item.stateReason);
      const ending = { outcome, label: endingLabels[outcome] };
      return { ...facts, kind: "closed", ending };
    }
    case "MergedEvent":
      return { ...facts, kind: "merged" };
    case "ReopenedEvent":
      return { ...facts, kind: "reopened" };
    case "AssignedEvent":
      return item.assignee?.login
        ? { ...facts, kind: "assigned", assignee: item.assignee.login }
        : undefined;
    default:
      return item.label
        ? { ...facts, kind: "labelled", label: item.label.name }
        : undefined;
  }
}

const summarise = (
  repo: string,
  kind: ThreadKind,
  node: OpenedNode | PullEventsNode,
): ThreadSummary => {
  const stack = readStackEntry("stackEntry" in node ? node.stackEntry : null);
  return {
    repo,
    number: node.number,
    url: node.url,
    kind,
    title: node.title,
    ...(stack ? { stack } : {}),
  };
};

/** The pull request a push to `ref` at `at` went to, if any. */
function findPull(
  pulls: readonly PullEventsNode[],
  push: FeedPush,
): PullEventsNode | undefined {
  // A branch name can serve several pull requests in turn; a push goes
  // to the latest one opened before it.
  return pulls
    .filter(
      (pull) =>
        !pull.isCrossRepository &&
        `refs/heads/${pull.headRefName}` === push.ref &&
        new Date(pull.createdAt) <= push.at,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .at(0);
}

/**
 * The checks-failed event on a pull request's head commit, dated by the
 * latest failed check and made by whoever ran it. A commit whose checks
 * did not fail, or failed before `since`, gives none.
 */
function findFailure(
  thread: ThreadSummary,
  pull: PullEventsNode,
  since: Date,
): ThreadEvent | undefined {
  const rollup = pull.head.nodes.at(-1)?.commit.statusCheckRollup;
  if (!rollup || !["FAILURE", "ERROR"].includes(rollup.state)) return;
  const failed = rollup.contexts.nodes
    .map(readCheck)
    .filter(({ state }) => state === "failing");
  const latest = failed
    .filter(({ at }) => at !== undefined)
    .sort((a, b) => Number(b.at) - Number(a.at))
    .at(0);
  if (!latest?.at || latest.at < since) return;
  return {
    thread,
    actor: latest.actor,
    at: latest.at,
    kind: "checksFailed",
    checks: failed.map(({ name }) => name),
  };
}

/**
 * Fetches the events on `repo`'s threads at or after `since`, oldest
 * thread first as GitHub lists them. Pushes come from the repository
 * activity feed, each counted from the pull request's commits where the
 * heads before and after it are among them. A pull request from a fork
 * has no pushes in the feed, so its head commit stands in for its latest
 * push, uncounted.
 *
 * Discussions give their openings and comments; GitHub records nobody
 * as closing one.
 *
 * @note Impure: reads from GitHub.
 */
export default async function fetchEvents(
  client: Client,
  repo: string,
  since: Date,
): Promise<ThreadEvent[]> {
  const found = await readThreads(client, repo, since);
  const events: ThreadEvent[] = [];
  const addOpening = (thread: ThreadSummary, node: OpenedNode) => {
    const at = new Date(node.createdAt);
    const actor: Account = readAccount(node.author);
    if (at >= since) events.push({ thread, actor, at, kind: "opened" });
  };
  const addTimeline = (thread: ThreadSummary, node: IssueEventsNode) => {
    const timeline = node.timelineItems.nodes
      .map((item) => readItem(thread, item))
      .filter((event) => event !== undefined);
    events.push(...dropMergeCloses(timeline));
  };
  for (const node of found.issues) {
    const thread = summarise(repo, "issue", node);
    addOpening(thread, node);
    addTimeline(thread, node);
  }
  for (const node of found.pullRequests) {
    const thread = summarise(repo, "pullRequest", node);
    addOpening(thread, node);
    addTimeline(thread, node);
    const failure = findFailure(thread, node, since);
    if (failure) events.push(failure);
    const head = node.head.nodes.at(-1)?.commit;
    const login = head?.author?.user?.login;
    if (node.isCrossRepository && head && login) {
      const at = new Date(head.committedDate);
      const actor: Account = { login, type: "user" };
      if (at >= since) events.push({ thread, actor, at, kind: "pushed" });
    }
  }
  for (const push of await fetchPushes(client, repo, since)) {
    const pull = findPull(found.pullRequests, push);
    if (!pull) continue;
    const thread = summarise(repo, "pullRequest", pull);
    const oids = pull.commits.nodes.map(({ commit }) => commit.oid);
    const commits = countCommits(oids, push.before, push.after);
    events.push({
      thread,
      actor: readAccount(push.actor),
      at: push.at,
      kind: "pushed",
      ...(commits === undefined ? {} : { commits }),
    });
  }
  for (const node of found.discussions) {
    const thread = summarise(repo, "discussion", node);
    addOpening(thread, node);
    for (const comment of node.comments.nodes) {
      const at = new Date(comment.createdAt);
      const actor = readAccount(comment.author);
      if (at >= since) events.push({ thread, actor, at, kind: "commented" });
    }
  }
  return events;
}
