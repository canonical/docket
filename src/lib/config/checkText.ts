import formatValue from "./formatValue.js";
import type { Checked } from "./types.js";

/**
 * Checks that `value` is text.
 *
 * @param path Where the value sits, such as `exempt.close`.
 */
export default function checkText(
  value: unknown,
  path: string,
): Checked<string> {
  if (typeof value === "string") return { value, errors: [] };
  return {
    value: undefined,
    errors: [
      {
        code: "CONFIG_WRONG_TYPE",
        message: `\`${path}\` holds \`${formatValue(value)}\`, which is not text.`,
        recovery:
          Array.isArray(value) || value instanceof Map
            ? "Write the value as text, not as a list or a map."
            : `Quote the value, as in \`${JSON.stringify(`${value}`)}\`.`,
      },
    ],
  };
}
