import { type Duration, parseDuration } from "../clock/index.js";
import { longestDuration } from "./constants.js";
import formatValue from "./formatValue.js";
import type { Checked } from "./types.js";

const longest = Object.entries(longestDuration)
  .map(([unit, amount]) => `\`${amount}${unit}\``)
  .join(", ")
  .replace(/, (?=[^,]*$)/, " or ");

/**
 * Reads a duration such as `24h`, `2d` or `1w`, no longer than
 * `longestDuration`.
 *
 * @param path Where the value sits, such as `targets.close.issue`.
 */
export default function checkDuration(
  value: unknown,
  path: string,
): Checked<Duration> {
  const duration = typeof value === "string" ? parseDuration(value) : undefined;
  if (!duration) {
    return {
      value: undefined,
      errors: [
        {
          code: "CONFIG_INVALID_DURATION",
          message: `\`${path}\` is \`${formatValue(value)}\`, which is not a duration.`,
          recovery:
            "Write a whole number followed by h, d or w, such as `24h`, `2d` or `1w`.",
        },
      ],
    };
  }
  if (duration.amount > longestDuration[duration.unit]) {
    return {
      value: undefined,
      errors: [
        {
          code: "CONFIG_INVALID_DURATION",
          message: `\`${path}\` is \`${formatValue(value)}\`, which is longer than docket accepts.`,
          recovery: `Write a duration no longer than ${longest}.`,
        },
      ],
    };
  }
  return { value: duration, errors: [] };
}
