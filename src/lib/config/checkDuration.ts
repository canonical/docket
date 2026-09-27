import { type Duration, parseDuration } from "../clock/index.js";
import type { Checked } from "./types.js";

/**
 * Reads a duration such as `24h`, `2d` or `1w`.
 *
 * @param path Where the value sits, such as `targets.close.issue`.
 */
export default function checkDuration(
  value: unknown,
  path: string,
): Checked<Duration> {
  const duration = typeof value === "string" ? parseDuration(value) : undefined;
  if (duration) return { value: duration, errors: [] };
  return {
    value: undefined,
    errors: [
      {
        code: "CONFIG_INVALID_DURATION",
        message: `\`${path}\` is \`${String(value)}\`, which is not a duration.`,
        recovery:
          "Write a whole number followed by h, d or w, such as `24h`, `2d` or `1w`.",
      },
    ],
  };
}
