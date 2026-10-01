import describeStackPlace from "./describeStackPlace.js";
import type { Heading } from "./types.js";

/**
 * A section heading's text: the owner or name it gives, or a stack's
 * parts in words, `example stack 3 · 3 PRs → main`, the one place a
 * stack's heading is worded whole.
 */
export default function nameHeading(heading: Heading): string {
  if (heading.kind !== "stack") return heading.text;
  return `${heading.repo} ${describeStackPlace(heading)}${heading.base}`;
}
