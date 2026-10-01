import { cacheFormat, dateTag } from "./constants.js";
import type { CacheFile } from "./types.js";
import writeWhole from "./writeWhole.js";

/** Writes each date as `{ "$date": "<ISO 8601>" }`, which JSON cannot hold. */
function tagDates(this: Record<string, unknown>, key: string, value: unknown) {
  const original = this[key];
  return original instanceof Date
    ? { [dateTag]: original.toISOString() }
    : value;
}

/**
 * Writes the cache file whole, as `writeWhole` writes, so a reader meets
 * the old file or the new one and never half of one, readable by its
 * owner alone, because it holds what the owner's account can see on
 * GitHub.
 *
 * `claim` hears what names the file written, as `identifyFile` names it,
 * before the file takes its place: a watcher can hear of the change and
 * identify the file before this function returns, so the writer has to
 * know the file as its own by then.
 *
 * @note Impure: writes the filesystem.
 */
export default function writeCacheFile(
  file: string,
  contents: CacheFile,
  claim: (written: string | undefined) => void,
): Promise<void> {
  const text = JSON.stringify({ format: cacheFormat, ...contents }, tagDates);
  return writeWhole(file, text, claim);
}
