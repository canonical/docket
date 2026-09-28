import { describeAge } from "../../../activity/index.js";
import type { CacheStatus } from "../../../cache/index.js";
import describeClock from "../../describeClock.js";
import type { StatusMessage } from "./types.js";

/**
 * Chooses the one message the status line shows for the cache's state.
 * The first that applies wins: an error, which says `rate limited`,
 * `offline` when a request got no answer, at all or in time, or else
 * `refresh failed`; the progress of a full refresh; a refresh in the
 * background; a short notice, such as when a full refresh is available
 * again; and otherwise how old the data is. With no data and nothing
 * happening there is no message.
 */
export default function describeStatus(
  status: CacheStatus,
  now: Date,
  timezone: string,
  names: Readonly<Record<string, string>>,
): StatusMessage | undefined {
  const { syncedAt, paused, failure, fullRefresh } = status;
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
  if (fullRefresh) {
    const { repo, position, count, fetched, total } = fullRefresh;
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
    const text = `synced ${describeAge(syncedAt, now)} ago`;
    return { kind: "freshness", text };
  }
  return undefined;
}
