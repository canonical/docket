import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import identifyFile from "./identifyFile.js";

/**
 * Writes `text` to `file` whole: into a temporary file beside it, then
 * renamed over it, so a reader meets the old file or the new one and
 * never half of one. The file is readable by its owner alone, in a folder
 * only its owner can enter.
 *
 * `claim`, when given, hears what names the file written, as
 * `identifyFile` names it, before the file takes its place: a watcher can
 * hear of the change and identify the file before this function returns.
 *
 * @note Impure: writes the filesystem.
 */
export default async function writeWhole(
  file: string,
  text: string,
  claim?: (written: string | undefined) => void,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, text, { mode: 0o600 });
    claim?.(await identifyFile(temporary));
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
