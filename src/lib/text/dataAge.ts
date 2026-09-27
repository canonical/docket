import sanitize from "./sanitize.js";
import type { Freshness } from "./types.js";

/**
 * How old the data behind an answer is, for a program: when it was
 * synced, its age in whole seconds, and any warning in force.
 */
export default function dataAge({ now, syncedAt, warnings }: Freshness) {
  return {
    syncedAt: syncedAt?.toISOString() ?? null,
    ageSeconds: syncedAt
      ? Math.max(0, Math.floor((now.getTime() - syncedAt.getTime()) / 1000))
      : null,
    warnings: warnings.map(({ code, message, recovery }) => ({
      code,
      message: sanitize(message),
      recovery: sanitize(recovery),
    })),
  };
}
