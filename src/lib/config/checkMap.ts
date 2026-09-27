import type { Checked, ConfigError } from "./types.js";

/**
 * Checks that `value` is a map whose keys are text and, when `keys` is
 * given, are all among them.
 *
 * @param path Where the value sits, such as `targets.close`.
 * @returns The map, without its unknown keys, or no value when `value` is
 * not a map.
 */
export default function checkMap(
  value: unknown,
  path: string,
  keys?: readonly string[],
): Checked<Map<string, unknown>> {
  if (!(value instanceof Map)) {
    return {
      value: undefined,
      errors: [
        {
          code: "CONFIG_WRONG_TYPE",
          message: `\`${path}\` is not a map of keys and values.`,
          recovery: `Write \`${path}\` as keys and values, one \`key: value\` per line.`,
        },
      ],
    };
  }
  const known = new Map<string, unknown>();
  const errors: ConfigError[] = [];
  for (const [key, entry] of value) {
    if (typeof key !== "string") {
      errors.push({
        code: "CONFIG_WRONG_TYPE",
        message: `\`${path}\` has the key \`${String(key)}\`, which is not text.`,
        recovery: `Quote the key, as in \`"${String(key)}"\`.`,
      });
    } else if (keys && !keys.includes(key)) {
      errors.push({
        code: "CONFIG_UNKNOWN_KEY",
        message: `\`${path}\` has the key \`${key}\`, which docket does not know.`,
        recovery: `Remove \`${key}\`, or use one of ${keys.map((name) => `\`${name}\``).join(", ")}.`,
      });
    } else {
      known.set(key, entry);
    }
  }
  return { value: known, errors };
}
