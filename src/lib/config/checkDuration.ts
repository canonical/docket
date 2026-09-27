import { type Duration, parseDuration } from "../clock/index.js";
import type { ConfigError } from "./types.js";

/**
 * Reads a duration such as `24h`, `2d` or `1w`.
 *
 * @param path Where the value sits, such as `targets.close.issue`.
 * @returns The duration, or `undefined` when `value` is not one.
 */
export default function checkDuration(
  value: unknown,
  path: string,
  errors: ConfigError[],
): Duration | undefined {
  const duration = typeof value === "string" ? parseDuration(value) : undefined;
  if (!duration) {
    errors.push({
      code: "CONFIG_DURATION",
      message: `\`${path}\` is \`${String(value)}\`, which is not a duration.`,
      recovery:
        "Write a whole number followed by h, d or w, such as `24h`, `2d` or `1w`.",
    });
  }
  return duration;
}
