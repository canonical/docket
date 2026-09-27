import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import parseFile from "./parseFile.js";
import type { FileOutcome } from "./types.js";

/** Where the personal file is, and what reading it gave. */
export interface PersonalFile {
  readonly path: string;
  /** `undefined` when no file exists at `path`. */
  readonly outcome: FileOutcome | undefined;
}

/**
 * Reads the personal file, `docket/docket.yaml` in the configuration
 * folder the XDG base-directory convention names: `$XDG_CONFIG_HOME`, or
 * `~/.config` when that is unset or not an absolute path, as the
 * convention says.
 *
 * @note Impure: reads the filesystem and the home folder. The environment
 * is an argument, so the caller decides when it is read.
 * @returns An outcome with errors when the file is invalid or cannot be
 * read. The caller stops then, because the file lists the repositories.
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { path, outcome: undefined };
    }
    return {
      path,
      outcome: {
        ok: false,
        errors: [
          {
            code: "CONFIG_UNREADABLE_FILE",
            message: `The personal file ${path} cannot be read.`,
            recovery: `Make ${path} a file you can read, or remove it.`,
          },
        ],
      },
    };
  }
  return { path, outcome: parseFile(text, "personal") };
}
