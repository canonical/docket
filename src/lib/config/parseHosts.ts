import checkList from "./checkList.js";
import type { Checked, ConfigError } from "./types.js";

/**
 * Reads the `hosts` section. GitHub Enterprise hosts are not supported, so
 * the one host accepted is `github.com`.
 */
export default function parseHosts(value: unknown): Checked<string[]> {
  const hosts = checkList(value, "hosts");
  if (!hosts.value) return { value: undefined, errors: hosts.errors };
  const errors: ConfigError[] = [];
  if (hosts.value.length === 0) {
    errors.push({
      code: "CONFIG_EMPTY_LIST",
      message: "`hosts` lists no host.",
      recovery: "Write `hosts: [github.com]`, or remove the section.",
    });
  }
  for (const host of hosts.value) {
    if (host !== "github.com") {
      errors.push({
        code: "CONFIG_UNSUPPORTED_HOST",
        message: `\`hosts\` lists \`${String(host)}\`, and docket supports only github.com.`,
        recovery: `Remove \`${String(host)}\` from \`hosts\`.`,
      });
    }
  }
  return { value: hosts.value as string[], errors };
}
