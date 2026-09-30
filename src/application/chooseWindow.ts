import type { Duration } from "../lib/clock/index.js";
import fail from "./fail.js";

/**
 * The configured window `--window` names, the first when it names none.
 * activity and finished take the same windows.
 *
 * @param windows The configured windows, in the order `t` steps through.
 * @param command The command whose help the refusal points to.
 * @throws Error `USAGE_INVALID_VALUE` when `--window` names no configured
 * window.
 */
export default function chooseWindow(
  windows: readonly Duration[],
  asked: string | undefined,
  command: string,
): Duration {
  const named = windows.map(
    (window) => [`${window.amount}${window.unit}`, window] as const,
  );
  const [first] = named;
  const chosen = asked ?? first?.[0];
  const window = named.find(([text]) => text === chosen)?.[1];
  if (!window) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--window\` takes one of the configured windows, ${named.map(([text]) => text).join(", ")}, not \`${chosen}\`.`,
      `run docket ${command} --help`,
    );
  }
  return window;
}
