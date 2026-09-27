import type { PageProgress } from "../provider/index.js";
import type { Client, PageNode } from "./types.js";

/** What every thread in the three lists gives. */
interface ListNode {
  readonly number: number;
  readonly updatedAt: string;
}

/** The three lists of a repository's threads, as a document names them. */
interface Lists<I, P, D> {
  readonly issues: I[];
  readonly pullRequests: P[];
  readonly discussions: D[];
}

type Kind = keyof Lists<never, never, never>;

const kinds: readonly Kind[] = ["issues", "pullRequests", "discussions"];

/** The variables that page each list and leave out a finished one. */
const names: Readonly<Record<Kind, readonly [string, string]>> = {
  issues: ["issuesAfter", "withIssues"],
  pullRequests: ["pullsAfter", "withPulls"],
  discussions: ["discussionsAfter", "withDiscussions"],
};

const newest = <T extends ListNode>(a: T, b: T): T =>
  Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;

/**
 * Reads every page of a repository's issues, pull requests and
 * discussions, all three in each query, keeping each thread once, in its
 * latest version: a list ordered by update can shift while it is read, so
 * a thread may come twice.
 *
 * Octokit's GraphQL pagination follows one list per document, so it would
 * take three queries a page where this takes one; this reads the three
 * together, leaves out each list once it is finished through `@include`,
 * and stops a list early at the first thread updated before `since`.
 *
 * @param document Reads `repository { issues pullRequests discussions }`,
 * each paged by `$issuesAfter`, `$pullsAfter` and `$discussionsAfter` and
 * included by `$withIssues`, `$withPulls` and `$withDiscussions`.
 * @param since Keeps only the threads updated at or after it, the lists
 * being ordered by update, newest first.
 * @param onPage Hears of each page read. The total comes from the lists'
 * `totalCount` on the first page and the page size `$size`; a document
 * that asks for no count gives the pages read so far.
 */
export default async function fetchLists<
  I extends ListNode,
  P extends ListNode,
  D extends ListNode,
>(
  client: Client,
  document: string,
  variables: Record<string, unknown>,
  since: Date | undefined,
  onPage?: (progress: PageProgress) => void,
): Promise<Lists<I, P, D>> {
  const found: Record<Kind, Map<number, ListNode>> = {
    issues: new Map(),
    pullRequests: new Map(),
    discussions: new Map(),
  };
  const reading: Record<Kind, { after: string | null; done: boolean }> = {
    issues: { after: null, done: false },
    pullRequests: { after: null, done: false },
    discussions: { after: null, done: false },
  };
  let fetched = 0;
  let total = 0;
  while (kinds.some((kind) => !reading[kind].done)) {
    const paging = Object.fromEntries(
      kinds.flatMap((kind) => {
        const [after, include] = names[kind];
        return [
          [after, reading[kind].after],
          [include, !reading[kind].done],
        ];
      }),
    );
    const { repository } = await client.query<{
      readonly repository: Partial<Record<Kind, PageNode<ListNode>>>;
    }>(document, { ...variables, ...paging });
    fetched += 1;
    if (fetched === 1) {
      for (const kind of kinds) {
        const count = repository[kind]?.totalCount;
        if (count) {
          total = Math.max(total, Math.ceil(count / Number(variables.size)));
        }
      }
    }
    // A list can grow while it is read, so the total never falls behind.
    total = Math.max(total, fetched);
    onPage?.({ fetched, total });
    for (const kind of kinds) {
      const list = repository[kind];
      if (!list) continue;
      let stale = false;
      for (const node of list.nodes) {
        if (since && Date.parse(node.updatedAt) < since.getTime()) {
          stale = true;
          continue;
        }
        const seen = found[kind].get(node.number);
        found[kind].set(node.number, seen ? newest(seen, node) : node);
      }
      const { hasNextPage, endCursor } = list.pageInfo;
      reading[kind] = { after: endCursor, done: stale || !hasNextPage };
    }
  }
  return {
    issues: [...found.issues.values()] as I[],
    pullRequests: [...found.pullRequests.values()] as P[],
    discussions: [...found.discussions.values()] as D[],
  };
}
