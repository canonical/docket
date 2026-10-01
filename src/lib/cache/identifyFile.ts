import { stat } from "node:fs/promises";

/**
 * Names what is at `path` apart from anything that was there before or
 * comes after: its inode and the moment it was created. The inode alone
 * is not enough, because the filesystem gives a removed entry's inode to
 * the next one it creates; on a filesystem that records no creation time,
 * the inode is all there is.
 *
 * @note Impure: reads the filesystem.
 * @returns Nothing when nothing is at `path`.
 */
export default async function identifyFile(
  path: string,
): Promise<string | undefined> {
  try {
    const { dev, ino, birthtimeNs } = await stat(path, { bigint: true });
    return `${dev}:${ino}:${birthtimeNs}`;
  } catch {
    return undefined;
  }
}
