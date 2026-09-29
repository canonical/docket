import { describeAge } from "../../../activity/index.js";
import type { AttentionState, CacheStatus } from "../../../cache/index.js";
import { tokens } from "../../../tokens/index.js";
import describeClock from "../../describeClock.js";
import findStageUnderWay from "../../findStageUnderWay.js";
import type { ActionResult, StatusMessage } from "./types.js";

/** How long, in milliseconds, the result of the user's own action stays. */
const resultShown = 5_000;

const failed = tokens["glyph.failed"];
const succeeded = tokens["glyph.succeeded"];
/** Between the fields of a message, a space either side. */
const separator = ` ${tokens["glyph.separator"]} `;

/**
 * Chooses the one message the status line shows for the cache's state
 * and the user's last action. The first that applies wins: an error,
 * which says `rate limited`, `offline` when a request got no answer, at
 * all or in time, or else `refresh failed`; the result of the user's own
 * action, for 5 seconds after it; the progress of a full refresh; a
 * refresh in the background, naming the first repository it is on and
 * its place among them, as `refreshing · docs 2/3` (while it is on none,
 * such as when it saves what it fetched, the messages below stand); a
 * short notice, such as when a full refresh is available again, or
 * `paused: budget low · resumes 14:20` while the budget is too low to
 * spend; and otherwise how old the data is, followed, while
 * the pane is idle, by `idle · any key wakes`. With no data and nothing
 * happening there is no message, and with no cache only an action's
 * result.
 */
export default function describeStatus(
  status: CacheStatus | undefined,
  now: Date,
  timezone: string,
  names: Readonly<Record<string, string>>,
  action?: ActionResult,
  attention?: AttentionState,
): StatusMessage | undefined {
  const paused = status?.paused;
  const failure = status?.failure;
  const syncedAt = status?.syncedAt;
  if (paused?.reason === "rateLimit") {
    const text = `${failed} rate limited${separator}resumes ${describeClock(paused.until, timezone)}`;
    return { kind: "error", text };
  }
  if (failure) {
    const what =
      failure.code === "GITHUB_RATE_LIMITED"
        ? "rate limited"
        : failure.code === "GITHUB_TIMED_OUT" ||
            failure.code === "GITHUB_UNREACHABLE"
          ? "offline"
          : "refresh failed";
    const from = syncedAt
      ? `${separator}data from ${describeClock(syncedAt, timezone)}`
      : "";
    return { kind: "error", text: `${failed} ${what}${from}` };
  }
  if (action && now.getTime() - action.at.getTime() < resultShown) {
    return action.failed
      ? { kind: "actionFailed", text: `${failed} ${action.text}` }
      : {
          kind: "action",
          text: `${succeeded} ${action.text}`,
          ...(action.people && { people: action.people }),
        };
  }
  if (!status) return undefined;
  const underWay = findStageUnderWay(status.stages);
  if (status.whole && underWay) {
    const { repo, position, count, fetched, total } = underWay;
    const text = `full refresh${separator}${names[repo] ?? repo} ${position}/${count}${separator}pages ${fetched}/${total}`;
    return { kind: "progress", text };
  }
  if (status.refreshing && underWay) {
    const { repo, position, count } = underWay;
    const text = `refreshing${separator}${names[repo] ?? repo} ${position}/${count}`;
    return { kind: "refreshing", text };
  }
  const wait = (status.fullRefreshAvailableAt?.getTime() ?? 0) - now.getTime();
  if (wait > 0) {
    const text = `full refresh available in ${Math.ceil(wait / 1000)}s`;
    return { kind: "notice", text };
  }
  if (paused) {
    const text = `paused: budget low${separator}resumes ${describeClock(paused.until, timezone)}`;
    return { kind: "notice", text };
  }
  if (syncedAt) {
    const suffix =
      attention === "idle" ? `${separator}idle${separator}any key wakes` : "";
    const text = `synced ${describeAge(syncedAt, now)} ago${suffix}`;
    return { kind: "freshness", text };
  }
  return undefined;
}
