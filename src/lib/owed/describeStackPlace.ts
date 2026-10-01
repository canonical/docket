import type { StackHeading } from "./types.js";

/** docket's words for a stack in its heading: `stack 3 · 3 PRs → `. */
export default function describeStackPlace({
  number,
  size,
}: Pick<StackHeading, "number" | "size">): string {
  const prs = size === 1 ? "1 PR" : `${size} PRs`;
  return `stack ${number} · ${prs} → `;
}
