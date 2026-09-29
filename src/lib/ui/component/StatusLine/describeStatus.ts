import { describeAge } from "../../../activity/index.js";
import type { AttentionState, CacheStatus } from "../../../cache/index.js";
import describeClock from "../../describeClock.js";
import type { ActionResult, StatusMessage } from "./types.js";

/** How long, in milliseconds, the result of the user's own action stays. */
const resultShown = 5_000;

/**
 * Chooses the one message the status line shows for the cache's state
 * and the user's last action. The first that applies wins: an error,
 * which says `rate limited`, `offline` when a request got no answer, at
 * all or in time, or else `refresh failed`; the result of the user's own
 * action, for 5 seconds after it; the progress of a full refresh; a
 * refresh in the background; a short notice, such as when a full refresh
 * is available again; and otherwise how old the data is, followed, while
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
    const text = `✗ rate limited · resumes ${describeClock(paused.until, timezone)}`;
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
      ? ` · data from ${describeClock(syncedAt, timezone)}`
      : "";
    return { kind: "error", text: `✗ ${what}${from}` };
  }
  if (action && now.getTime() - action.at.getTime() < resultShown) {
    return action.failed
      ? { kind: "actionFailed", text: `✗ ${action.text}` }
      : {
          kind: "action",
          text: `✓ ${action.text}`,
          ...(action.people && { people: action.people }),
        };
  }
  if (!status) return undefined;
  if (status.fullRefresh) {
    const { repo, position, count, fetched, total } = status.fullRefresh;
    const text = `full refresh · ${names[repo] ?? repo} ${position}/${count} · pages ${fetched}/${total}`;
    return { kind: "progress", text };
  }
  if (status.refreshing) return { kind: "refreshing", text: "refreshing…" };
  const wait = (status.fullRefreshAvailableAt?.getTime() ?? 0) - now.getTime();
  if (wait > 0) {
    const text = `full refresh available in ${Math.ceil(wait / 1000)}s`;
    return { kind: "notice", text };
  }
  if (paused) {
    const text = `refresh paused · resumes ${describeClock(paused.until, timezone)}`;
    return { kind: "notice", text };
  }
  if (syncedAt) {
    const suffix = attention === "idle" ? " · idle · any key wakes" : "";
    const text = `synced ${describeAge(syncedAt, now)} ago${suffix}`;
    return { kind: "freshness", text };
  }
  return undefined;
}
