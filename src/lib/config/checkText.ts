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
        message: `\`${path}\` holds \`${String(value)}\`, which is not text.`,
        recovery: `Quote the value, as in \`"${String(value)}"\`.`,
      },
    ],
  };
}
