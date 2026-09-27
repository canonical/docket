import checkList from "./checkList.js";
import type { ConfigError } from "./types.js";

/**
 * Reads the `hosts` section. GitHub Enterprise hosts are not supported, so
 * the one host accepted is `github.com`.
 */
export default function parseHosts(
  value: unknown,
  errors: ConfigError[],
): string[] | undefined {
  const hosts = checkList(value, "hosts", errors);
  if (!hosts) return undefined;
  if (hosts.length === 0) {
    errors.push({
      code: "CONFIG_EMPTY",
      message: "`hosts` lists no host.",
      recovery: "Write `hosts: [github.com]`, or remove the section.",
    });
  }
  for (const host of hosts) {
    if (host !== "github.com") {
      errors.push({
        code: "CONFIG_HOST",
        message: `\`hosts\` lists \`${String(host)}\`, and docket supports only github.com.`,
        recovery: `Remove \`${String(host)}\` from \`hosts\`.`,
      });
    }
  }
  return hosts as string[];
}
