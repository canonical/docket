import type { Thread } from "../waits/index.js";

/** Names a thread within its repository: discussions number apart. */
const identify = ({ kind, number }: Thread) =>
  `${kind === "discussion" ? "discussion" : "issue"} ${number}`;

/**
 * Applies a snapshot since a cursor to a repository's open threads: each
 * thread in it replaces its earlier copy, and one that is no longer open
 * leaves.
 */
export default function mergeSnapshot(
  threads: readonly Thread[],
  changed: readonly Thread[],
): Thread[] {
  const replaced = new Set(changed.map(identify));
  return [
    ...threads.filter((thread) => !replaced.has(identify(thread))),
    ...changed.filter(({ open }) => open),
  ];
}
