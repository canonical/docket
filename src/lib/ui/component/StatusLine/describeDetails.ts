import type { AttentionState, CacheStatus } from "../../../cache/index.js";
import type { DetailsCount, StatusMessage } from "./types.js";

/**
 * What the right side of the status line says of the details, or nothing:
 * `details 3/12` while any asked for are unread, unless the left side
 * shows an error, the rate limit refused a request, the refresh is
 * paused, the pane is idle or nothing is shown yet, as on the first run.
 */
export default function describeDetails(
  status: CacheStatus | undefined,
  message: StatusMessage | undefined,
  attention: AttentionState | undefined,
  details: DetailsCount | undefined,
): string {
  const counted =
    details &&
    message?.kind !== "error" &&
    status?.failure?.code !== "GITHUB_RATE_LIMITED" &&
    attention !== "idle" &&
    status?.paused === undefined &&
    status?.syncedAt !== undefined;
  return counted ? `details ${details.read}/${details.asked}` : "";
}
