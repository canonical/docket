import type { ConfigError } from "./types.js";

/**
 * Checks that `value` is text.
 *
 * @param path Where the value sits, such as `exempt.close`.
 * @returns The text, or `undefined` when `value` is not text.
 */
export default function checkText(
  value: unknown,
  path: string,
  errors: ConfigError[],
): string | undefined {
  if (typeof value === "string") return value;
  errors.push({
    code: "CONFIG_WRONG_TYPE",
    message: `\`${path}\` holds \`${String(value)}\`, which is not text.`,
    recovery: `Quote the value, as in \`"${String(value)}"\`.`,
  });
  return undefined;
}
