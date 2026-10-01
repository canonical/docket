import type { Duration } from "../lib/clock/index.js";
import {
  type FinishedAddress,
  finishedGroupings,
} from "../lib/finished/index.js";
import chooseWindow from "./chooseWindow.js";
import fail from "./fail.js";
import type { Invocation } from "./types.js";

/**
 * The window and grouping a call names for finished: the configured
 * window `--window` names, the first when it names none, and the grouping
 * `--by` names. Text mode and the terminal interface read the same
 * address, so `docket finished --window 1w --by ending` prints that list,
 * or opens the terminal interface on it.
 *
 * @param windows The configured windows, in the order `t` steps through.
 * @throws Error `USAGE_INVALID_VALUE` when `--window` names no configured
 * window or `--by` no grouping of finished.
 */
export default function chooseFinishedAddress(
  windows: readonly Duration[],
  invocation: Pick<Invocation, "window" | "by">,
): Pick<FinishedAddress, "window" | "grouping"> {
  const window = chooseWindow(windows, invocation.window, "finished");
  const grouping = finishedGroupings.find((entry) => entry === invocation.by);
  if (!grouping) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--by\` takes ${finishedGroupings.join(", ")}, not \`${invocation.by}\`.`,
      "run docket finished --help",
    );
  }
  return { window, grouping };
}
