import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DehydratedState } from "@tanstack/query-core";
import { cacheFormat, dateTag } from "./constants.js";

/** Writes each date as `{ "$date": "<ISO 8601>" }`, which JSON cannot hold. */
function tagDates(this: Record<string, unknown>, key: string, value: unknown) {
  const original = this[key];
  return original instanceof Date
    ? { [dateTag]: original.toISOString() }
    : value;
}

/**
 * Writes the cache file whole: into a temporary file beside it, then
 * renamed over it, so a reader meets the old file or the new one and
 * never half of one. The file is readable by its owner alone, in a folder
 * only its owner can enter, because it holds what the owner's account can
 * see on GitHub.
 *
 * @note Impure: writes the filesystem.
 */
export default async function writeCacheFile(
  file: string,
  state: DehydratedState,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const text = JSON.stringify({ format: cacheFormat, state }, tagDates);
  try {
    await writeFile(temporary, text, { mode: 0o600 });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
