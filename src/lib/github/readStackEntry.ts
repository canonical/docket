import type { StackEntry } from "../stacks/index.js";
import type { StackEntryNode } from "./types.js";

/** Reads where a pull request sits in its stack; absent outside one. */
export default function readStackEntry(
  node: StackEntryNode,
): StackEntry | undefined {
  if (!node) return undefined;
  return {
    number: node.stack.number,
    position: node.position,
    size: node.stack.size,
    base: node.stack.baseRefName,
  };
}
