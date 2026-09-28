import type { StackEntry } from "../stacks/index.js";

/**
 * Names a pull request's place in its stack in words, such as
 * `example stack 3, 2 of 5`, using GitHub's word and never `#`.
 *
 * @param repo The short name of the pull request's repository.
 */
export default function describeStack(repo: string, stack: StackEntry): string {
  return `${repo} stack ${stack.number}, ${stack.position} of ${stack.size}`;
}
