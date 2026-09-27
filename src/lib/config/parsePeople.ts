import checkMap from "./checkMap.js";
import type { ConfigError, Group, People } from "./types.js";

const groups: readonly unknown[] = ["team", "internal", "external", "bot"];

/** Reads the `people` section: each login and the one group it is in. */
export default function parsePeople(
  value: unknown,
  errors: ConfigError[],
): People | undefined {
  const entries = checkMap(value, "people", errors);
  if (!entries) return undefined;
  const people = new Map<string, Group>();
  const written = new Map<string, string>();
  for (const [login, group] of entries) {
    const key = login.toLowerCase();
    const earlier = written.get(key);
    if (earlier !== undefined) {
      errors.push({
        code: "CONFIG_DUPLICATE_KEY",
        message: `\`people\` lists both \`${earlier}\` and \`${login}\`, which are one login, because GitHub logins ignore case.`,
        recovery: `Keep one entry for \`${login}\`, with the one group it belongs to.`,
      });
    } else if (!groups.includes(group)) {
      errors.push({
        code: "CONFIG_UNKNOWN_GROUP",
        message: `\`people.${login}\` is \`${String(group)}\`, which is not a group.`,
        recovery: "Write one of `team`, `internal`, `external` or `bot`.",
      });
    } else {
      people.set(key, group as Group);
    }
    written.set(key, login);
  }
  return people;
}
