import type { Stack, Stackable } from "./types.js";

interface Gathered<T> {
  readonly repo: string;
  readonly number: number;
  readonly size: number;
  readonly base: string;
  readonly members: { readonly thread: T; readonly position: number }[];
}

/**
 * Gathers the given pull requests into the stacks they sit in. Stacks come
 * in the order their first member is given, and each stack's members come
 * by position, bottom first. A pull request in no stack joins none.
 *
 * A stack owns no clock, so this is only the relation: every pull request
 * keeps its own waits. Stack numbers are unique only within a repository,
 * so the repository is part of a stack's identity.
 */
export default function collectStacks<T extends Stackable>(
  threads: readonly T[],
): Stack<T>[] {
  const stacks = new Map<string, Gathered<T>>();
  for (const thread of threads) {
    const entry = thread.stack;
    if (!entry) continue;
    const key = `${thread.repo} ${entry.number}`;
    const stack = stacks.get(key) ?? {
      repo: thread.repo,
      number: entry.number,
      size: entry.size,
      base: entry.base,
      members: [],
    };
    stacks.set(key, stack);
    stack.members.push({ thread, position: entry.position });
  }
  return [...stacks.values()].map((stack) => ({
    ...stack,
    members: stack.members
      .sort((a, b) => a.position - b.position)
      .map(({ thread }) => thread),
  }));
}
