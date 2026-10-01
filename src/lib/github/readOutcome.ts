import type { Outcome } from "../endings/index.js";
import type { ThreadKind } from "../waits/index.js";

/** The outcome each reason GitHub records for an issue's close stands for. */
const reasons: Readonly<Record<string, Outcome>> = {
  COMPLETED: "completed",
  NOT_PLANNED: "notPlanned",
  DUPLICATE: "duplicate",
};

/**
 * Reads how a close ended a thread, from the reason GitHub records. Only
 * an issue's reason means anything: GitHub records `COMPLETED` on every
 * pull request's close, merged or not, so a pull request's close is
 * `closed`, as is an issue's with no reason recorded.
 *
 * @param stateReason The thread's, or its close's, `stateReason`.
 */
export default function readOutcome(
  kind: ThreadKind,
  stateReason: string | null | undefined,
): Outcome {
  if (kind !== "issue" || !stateReason) return "closed";
  return reasons[stateReason] ?? "closed";
}
