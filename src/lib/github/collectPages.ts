import type { PageNode } from "./types.js";

/**
 * Collects every node of a GraphQL list, one page after another.
 *
 * @param read Fetches the page after the cursor it is given, `null` for
 * the first; gives nothing when the list itself is missing.
 */
export default async function collectPages<T>(
  read: (after: string | null) => Promise<PageNode<T> | undefined>,
): Promise<T[]> {
  const nodes: T[] = [];
  let after: string | null = null;
  for (;;) {
    const page: PageNode<T> | undefined = await read(after);
    if (!page) return nodes;
    nodes.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return nodes;
    after = page.pageInfo.endCursor;
  }
}
