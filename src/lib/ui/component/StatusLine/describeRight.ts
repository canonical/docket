import type { AttentionState, CacheStatus } from "../../../cache/index.js";
import type { DetailsCount, StatusMessage } from "./types.js";

/**
 * What the right side of the status line says, or nothing: `details 3/12`
 * while any details asked for are unread, else `budget`, the words for the
 * queries' budget once it runs low, such as `budget 35% · resets 14:20`.
 * Neither shows while the left side shows an error, the rate limit
 * refused a request, the refresh is paused, the pane is idle or nothing is
 * shown yet, as on the first run: at the budget floor the left side says
 * the refresh paused, and until when.
 */
export default function describeRight(
  status: CacheStatus | undefined,
  message: StatusMessage | undefined,
  attention: AttentionState | undefined,
  details: DetailsCount | undefined,
  budget: string,
): string {
  const shown =
    message?.kind !== "error" &&
    status?.failure?.code !== "GITHUB_RATE_LIMITED" &&
    attention !== "idle" &&
    status?.paused === undefined &&
    status?.syncedAt !== undefined;
  if (!shown) return "";
  return details ? `details ${details.read}/${details.asked}` : budget;
}
