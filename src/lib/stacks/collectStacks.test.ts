import { describe, expect, it } from "vitest";
import collectStacks from "./collectStacks.js";
import type { StackEntry } from "./types.js";

const repo = "example-org/example-repo";
const entry = (position: number, number = 12): StackEntry => ({
  number,
  position,
  size: 3,
  base: "main",
});
const pull = (id: number, stack?: StackEntry, where = repo) => ({
  id,
  repo: where,
  stack,
});

describe("collectStacks", () => {
  it("gathers the pull requests of one stack by position, bottom first", () => {
    const threads = [pull(3, entry(3)), pull(1, entry(1)), pull(2, entry(2))];
    expect(collectStacks(threads)).toEqual([
      {
        repo,
        number: 12,
        size: 3,
        base: "main",
        members: [threads[1], threads[2], threads[0]],
      },
    ]);
  });

  it("leaves out pull requests that sit in no stack", () => {
    expect(collectStacks([pull(1), pull(2)])).toEqual([]);
  });

  it("keeps the stack's full size when some of its pull requests are not given", () => {
    const [stack] = collectStacks([pull(2, entry(2))]);
    expect(stack?.size).toBe(3);
    expect(stack?.members.map(({ id }) => id)).toEqual([2]);
  });

  it("keeps stacks with the same number in two repositories apart", () => {
    const other = "example-org/example-docs";
    const stacks = collectStacks([
      pull(1, entry(1)),
      pull(2, entry(1), other),
      pull(3, entry(2)),
    ]);
    expect(stacks.map((stack) => [stack.repo, stack.number])).toEqual([
      [repo, 12],
      [other, 12],
    ]);
    expect(stacks[0]?.members.map(({ id }) => id)).toEqual([1, 3]);
  });

  it("gives stacks in the order their first pull request is given", () => {
    const stacks = collectStacks([
      pull(1, entry(1, 20)),
      pull(2, entry(1, 7)),
      pull(3, entry(2, 20)),
    ]);
    expect(stacks.map(({ number }) => number)).toEqual([20, 7]);
  });
});
