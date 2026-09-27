import type { Duration } from "../clock/index.js";
import checkDuration from "./checkDuration.js";
import checkList from "./checkList.js";
import type { ConfigError } from "./types.js";

/** Reads the `activity` section: the time windows, the first the default. */
export default function parseActivity(
  value: unknown,
  errors: ConfigError[],
): Duration[] | undefined {
  const windows = checkList(value, "activity", errors);
  if (!windows) return undefined;
  if (windows.length === 0) {
    errors.push({
      code: "CONFIG_EMPTY",
      message: "`activity` lists no time window.",
      recovery: "List at least one window, such as `[24h, 48h, 72h, 1w]`.",
    });
  }
  return windows.flatMap((window) => {
    const duration = checkDuration(window, "activity", errors);
    return duration ? [duration] : [];
  });
}
