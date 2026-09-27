import type { Checked } from "./types.js";

/**
 * Checks that `value` is a list.
 *
 * @param path Where the value sits, such as `time.workdays`.
 */
export default function checkList(
  value: unknown,
  path: string,
): Checked<unknown[]> {
  if (Array.isArray(value)) return { value, errors: [] };
  return {
    value: undefined,
    errors: [
      {
        code: "CONFIG_WRONG_TYPE",
        message: `\`${path}\` is not a list.`,
        recovery: `Write \`${path}\` as a list, such as \`[first, second]\`.`,
      },
    ],
  };
}
