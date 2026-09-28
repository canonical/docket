import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

/**
 * Names docket's cache folder, `docket` in the folder the XDG
 * base-directory convention names: `$XDG_CACHE_HOME`, or `~/.cache` when
 * that is unset or not an absolute path, as the convention says.
 *
 * @note Impure: reads the home folder. The environment is an argument,
 * so the caller decides when it is read.
 */
export default function locateCacheDirectory(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const configured = environment.XDG_CACHE_HOME ?? "";
  const folder = isAbsolute(configured)
    ? configured
    : join(homedir(), ".cache");
  return join(folder, "docket");
}
