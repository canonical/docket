import { readFile } from "node:fs/promises";
import { cacheFormat, dateTag } from "./constants.js";
import type { CacheFile } from "./types.js";

/** Reads `{ "$date": "<ISO 8601>" }` back as a date. */
function readDates(_key: string, value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const date = (value as Record<string, unknown>)[dateTag];
  return typeof date === "string" && Object.keys(value).length === 1
    ? new Date(date)
    : value;
}

/**
 * Reads the cache file that `writeCacheFile` wrote.
 *
 * @note Impure: reads the filesystem.
 * @returns Nothing when there is no file yet, or when it cannot be read,
 * is not JSON, or has another layout: the data is then fetched again.
 */
export default async function readCacheFile(
  file: string,
): Promise<CacheFile | undefined> {
  try {
    const { format, state, fullRefreshAt } = JSON.parse(
      await readFile(file, "utf8"),
      readDates,
    );
    if (format !== cacheFormat) return undefined;
    return {
      state,
      fullRefreshAt: fullRefreshAt instanceof Date ? fullRefreshAt : undefined,
    };
  } catch {
    return undefined;
  }
}
