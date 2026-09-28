import {
  type ActivityAddress,
  activityGroupings,
} from "../lib/activity/index.js";
import type { Duration } from "../lib/clock/index.js";
import fail from "./fail.js";
import type { Invocation } from "./types.js";

/**
 * The window and grouping a call names for activity: the configured
 * window `--window` names, the first when it names none, and the grouping
 * `--by` names. Text mode and the terminal interface read the same
 * address, so `docket activity --window 72h --by repo` prints that list,
 * or opens the terminal interface on it.
 *
 * @param windows The configured windows, in the order `t` steps through.
 * @throws Error `USAGE_INVALID_VALUE` when `--window` names no configured
 * window or `--by` no grouping of activity.
 */
export default function chooseActivityAddress(
  windows: readonly Duration[],
  invocation: Pick<Invocation, "window" | "by">,
): Pick<ActivityAddress, "window" | "grouping"> {
  const named = windows.map(
    (window) => [`${window.amount}${window.unit}`, window] as const,
  );
  const [first] = named;
  const asked = invocation.window ?? first?.[0];
  const window = named.find(([text]) => text === asked)?.[1];
  if (!window) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--window\` takes one of the configured windows, ${named.map(([text]) => text).join(", ")}, not \`${asked}\`.`,
      "run docket activity --help",
    );
  }
  const grouping = activityGroupings.find((entry) => entry === invocation.by);
  if (!grouping) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--by\` takes ${activityGroupings.join(", ")}, not \`${invocation.by}\`.`,
      "run docket activity --help",
    );
  }
  return { window, grouping };
}
