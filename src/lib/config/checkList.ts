import type { ConfigError } from "./types.js";

/**
 * Checks that `value` is a list.
 *
 * @param path Where the value sits, such as `time.workdays`.
 * @returns The list, or `undefined` when `value` is not a list.
 */
export default function checkList(
  value: unknown,
  path: string,
  errors: ConfigError[],
): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  errors.push({
    code: "CONFIG_TYPE",
    message: `\`${path}\` is not a list.`,
    recovery: `Write \`${path}\` as a list, such as \`[first, second]\`.`,
  });
  return undefined;
}
