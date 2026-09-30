import type { AttentionState, CacheStatus } from "../../../cache/index.js";
import type { DetailsCount, StatusMessage } from "./types.js";

/**
 * What the right side of the status line says of the details, or nothing:
 * `details paused` once their hour's budget is spent, unless the left
 * side shows an error, the rate limit pauses the refresh or the pane is
 * idle; otherwise `details 3/12` while any asked for are unread, unless
 * the left side shows an error, the refresh is paused, the pane is idle
 * or nothing is shown yet, as on the first run.
 */
export default function describeDetails(
  status: CacheStatus | undefined,
  message: StatusMessage | undefined,
  attention: AttentionState | undefined,
  detailsPaused: boolean | undefined,
  details: DetailsCount | undefined,
): string {
  const quiet =
    message?.kind === "error" ||
    status?.paused?.reason === "rateLimit" ||
    attention === "idle";
  if (detailsPaused && !quiet) return "details paused";
  const counted =
    details &&
    !quiet &&
    status?.paused === undefined &&
    status?.syncedAt !== undefined;
  return counted ? `details ${details.read}/${details.asked}` : "";
}
