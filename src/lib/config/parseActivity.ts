import type { Duration } from "../clock/index.js";
import checkDuration from "./checkDuration.js";
import checkList from "./checkList.js";
import type { Checked, ConfigError } from "./types.js";

/** Reads the `activity` section: the time windows, the first the default. */
export default function parseActivity(value: unknown): Checked<Duration[]> {
  const windows = checkList(value, "activity");
  if (!windows.value) return { value: undefined, errors: windows.errors };
  const errors: ConfigError[] = [];
  if (windows.value.length === 0) {
    errors.push({
      code: "CONFIG_EMPTY_LIST",
      message: "`activity` lists no time window.",
      recovery: "List at least one window, such as `[24h, 48h, 72h, 1w]`.",
    });
  }
  const durations: Duration[] = [];
  for (const window of windows.value) {
    const duration = checkDuration(window, "activity");
    errors.push(...duration.errors);
    if (duration.value) durations.push(duration.value);
  }
  return { value: durations, errors };
}
