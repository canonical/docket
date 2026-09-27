import { collectStacks } from "../lib/stacks/index.js";
import type { Thread } from "../lib/waits/index.js";
import fail from "./fail.js";
import type { Reference } from "./parseReference.js";

/**
 * Finds the open threads a reference names among the cached ones: the
 * thread, or every pull request of the stack, bottom first.
 *
 * @throws Error `THREAD_NOT_FOUND` when none is open: docket keeps only
 * open threads.
 */
export default function findThreads(
  threads: readonly Thread[],
  reference: Reference,
): readonly [Thread, ...Thread[]] {
  const { repo, number, stack } = reference;
  const own = threads.filter((thread) => thread.repo === repo.repo);
  const found = stack
    ? (collectStacks(own).find((entry) => entry.number === number)?.members ??
      [])
    : own.filter((thread) => thread.number === number);
  const [first, ...rest] = found;
  if (!first) {
    fail(
      "THREAD_NOT_FOUND",
      `No open thread of ${repo.repo} answers to ${reference.text}.`,
      `check that ${reference.text} is open, then run the command again with --max-age 0 to read the latest data`,
    );
  }
  return [first, ...rest];
}
