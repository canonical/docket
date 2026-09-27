import { readFile, readlink } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import parseFile from "./parseFile.js";
import type { ConfigError, FileOutcome } from "./types.js";

/** Where the personal file is, and what reading it gave. */
export interface PersonalFile {
  readonly path: string;
  /** `undefined` when no file exists at `path`. */
  readonly outcome: FileOutcome | undefined;
}

/**
 * Gives the target of the link at `path` when it is a link, or `undefined`
 * when nothing is there or it is not a link.
 */
async function readLinkTarget(path: string): Promise<string | undefined> {
  try {
    return await readlink(path);
  } catch {
    return undefined;
  }
}

function fail(path: string, error: ConfigError): PersonalFile {
  return { path, outcome: { ok: false, errors: [error] } };
}

/**
 * Reads the personal file, `docket/docket.yaml` in the configuration
 * folder the XDG base-directory convention names: `$XDG_CONFIG_HOME`, or
 * `~/.config` when that is unset or not an absolute path, as the
 * convention says.
 *
 * @note Impure: reads the filesystem and the home folder. The environment
 * is an argument, so the caller decides when it is read.
 * @returns An outcome with errors when the file is invalid, cannot be
 * read or is a link to nothing. The caller stops then, because the file
 * lists the repositories.
 */
export default async function readPersonalFile(
  environment: Readonly<Record<string, string | undefined>>,
): Promise<PersonalFile> {
  const configured = environment.XDG_CONFIG_HOME ?? "";
  const folder = isAbsolute(configured)
    ? configured
    : join(homedir(), ".config");
  const path = join(folder, "docket", "docket.yaml");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return fail(path, {
        code: "CONFIG_UNREADABLE_FILE",
        message: `The personal file ${path} cannot be read.`,
        recovery: `Make ${path} a file you can read, or remove it.`,
      });
    }
    // The file is often a link into a dotfiles folder. A link whose target
    // is gone is a mistake to report, never a sign that there is no file.
    const target = await readLinkTarget(path);
    if (target === undefined) return { path, outcome: undefined };
    return fail(path, {
      code: "CONFIG_BROKEN_LINK",
      message: `The personal file ${path} is a link to ${target}, which does not exist.`,
      recovery: `Point ${path} at a file that exists, or remove the link.`,
    });
  }
  return { path, outcome: parseFile(text, "personal") };
}
