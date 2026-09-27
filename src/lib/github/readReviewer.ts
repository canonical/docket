import type { Reviewer } from "../provider/index.js";
import readAccount from "./readAccount.js";
import type { ReviewerNode } from "./types.js";

/**
 * Reads a requested reviewer: a person, a bot, or a team named
 * `organisation/team`. It is absent when GitHub gives nothing, as it does
 * for a reviewer whose account was deleted or is hidden from the reader,
 * and for a placeholder account left by an import.
 */
export default function readReviewer(node: ReviewerNode): Reviewer | undefined {
  if (node?.combinedSlug) return { team: node.combinedSlug };
  if (node?.login) return readAccount({ ...node, login: node.login });
  return undefined;
}
