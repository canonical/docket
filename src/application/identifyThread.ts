import type { ThreadSummary } from "../lib/waits/index.js";

/** Names a thread by its repository and number, which no other shares. */
export default function identifyThread({
  repo,
  number,
}: Pick<ThreadSummary, "repo" | "number">): string {
  return `${repo}#${number}`;
}
