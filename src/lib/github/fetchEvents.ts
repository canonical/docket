import type { ThreadEvent } from "../events/index.js";
import type { Account } from "../people/index.js";
import type { ThreadKind, ThreadSummary } from "../waits/index.js";
import countCommits from "./countCommits.js";
import fetchPushes from "./fetchPushes.js";
import readAccount from "./readAccount.js";
import readCheck from "./readCheck.js";
import splitRepo from "./splitRepo.js";
import type {
  ActorNode,
  CheckNode,
  Client,
  FeedPush,
  HeadCommitNode,
  PageNode,
} from "./types.js";

const account = "login __typename";
const actor = `actor { ${account} } createdAt`;
const issueItems = `__typename
  ... on IssueComment { author { ${account} } createdAt }
  ... on ClosedEvent { ${actor} }
  ... on ReopenedEvent { ${actor} }
  ... on AssignedEvent { ${actor} assignee { ... on User { login } ... on Bot { login } } }
  ... on LabeledEvent { ${actor} label { name } }`;
const pullItems = `${issueItems}
  ... on PullRequestReview { author { ${account} } submittedAt }
  ... on ReviewRequestedEvent { ${actor} }
  ... on MergedEvent { ${actor} }`;
const issueTypes =
  "ISSUE_COMMENT, CLOSED_EVENT, REOPENED_EVENT, ASSIGNED_EVENT, LABELED_EVENT";
const order = "orderBy: { field: UPDATED_AT, direction: DESC }";
const pageInfo = "pageInfo { hasNextPage endCursor }";
const opened = `number title createdAt updatedAt author { ${account} }`;
const check = `__typename
  ... on CheckRun { name status conclusion completedAt checkSuite { app { slug } } }
  ... on StatusContext { context state createdAt creator { ${account} } }`;

const document = `query Events($owner: String!, $name: String!, $since: DateTime!,
  $issuesAfter: String, $pullsAfter: String, $discussionsAfter: String,
  $withIssues: Boolean!, $withPulls: Boolean!, $withDiscussions: Boolean!) {
  rateLimit { limit remaining resetAt }
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
        stackEntry { position stack { number size baseRefName } }
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
  readonly assignee?: { readonly login?: string } | null;
  readonly label?: { readonly name: string } | null;
}

interface OpenedNode {
  readonly number: number;
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
  readonly stackEntry: {
    readonly position: number;
    readonly stack: {
      readonly number: number;
      readonly size: number;
      readonly baseRefName: string;
    };
  } | null;
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

interface Answer {
  readonly repository: {
    readonly issues?: PageNode<IssueEventsNode>;
    readonly pullRequests?: PageNode<PullEventsNode>;
    readonly discussions?: PageNode<DiscussionEventsNode>;
  };
}

type Kind = "issues" | "pullRequests" | "discussions";

/** Reads the three lists of threads updated at or after `since`. */
async function readThreads(client: Client, repo: string, since: Date) {
  const { owner, name } = splitRepo(repo);
  const found = {
    issues: [] as IssueEventsNode[],
    pullRequests: [] as PullEventsNode[],
    discussions: [] as DiscussionEventsNode[],
  };
  const after: Record<Kind, string | null> = {
    issues: null,
    pullRequests: null,
    discussions: null,
  };
  const done: Record<Kind, boolean> = {
    issues: false,
    pullRequests: false,
    discussions: false,
  };
  while (!(done.issues && done.pullRequests && done.discussions)) {
    const { repository } = await client.query<Answer>(document, {
      owner,
      name,
      since: since.toISOString(),
      issuesAfter: after.issues,
      pullsAfter: after.pullRequests,
      discussionsAfter: after.discussions,
      withIssues: !done.issues,
      withPulls: !done.pullRequests,
      withDiscussions: !done.discussions,
    });
    for (const kind of ["issues", "pullRequests", "discussions"] as const) {
      const list = repository[kind];
      if (!list) continue;
      // Issues are filtered by GitHub; the other lists are ordered by
      // update, so they stop at the first thread updated before `since`.
      const fresh = list.nodes.filter(
        ({ updatedAt }) => new Date(updatedAt) >= since,
      );
      (found[kind] as OpenedNode[]).push(...fresh);
      after[kind] = list.pageInfo.endCursor;
      done[kind] =
        fresh.length < list.nodes.length || !list.pageInfo.hasNextPage;
    }
  }
  return found;
}

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
    case "ClosedEvent":
      return { ...facts, kind: "closed" };
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
  const entry = "stackEntry" in node ? node.stackEntry : null;
  return {
    repo,
    number: node.number,
    kind,
    title: node.title,
    ...(entry
      ? {
          stack: {
            number: entry.stack.number,
            position: entry.position,
            size: entry.stack.size,
            base: entry.stack.baseRefName,
          },
        }
      : {}),
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
    for (const item of node.timelineItems.nodes) {
      const event = readItem(thread, item);
      if (event) events.push(event);
    }
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
