/**
 * A throwaway git repository with one commit and a linked worktree, which
 * the gates' tests point git at through its environment variables, to prove
 * a self-test leaves it alone.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A throwaway repository. */
export interface Repository {
  root: string;
  gitDirectory: string;
  /** The git directory of its linked worktree, `.git/worktrees/side`. */
  linkedGitDirectory: string;
  /** Its HEAD, refs, index and config, as one comparable text. */
  readState: () => string;
  /** Deletes it. */
  remove: () => void;
}

/**
 * The ways a caller points git at a repository: `GIT_DIR` naming a linked
 * worktree's git directory, as `git rebase --exec` and hooks export it when
 * run in a linked worktree, and `GIT_DIR` with `GIT_WORK_TREE` and
 * `GIT_INDEX_FILE` beside it. In a plain checkout, rebase exports no
 * `GIT_DIR`.
 */
export const pointings: Record<
  string,
  (repository: Repository) => Record<string, string>
> = {
  "a linked worktree's GIT_DIR": ({ linkedGitDirectory }) => ({
    GIT_DIR: linkedGitDirectory,
  }),
  "GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE": ({ root, gitDirectory }) => ({
    GIT_DIR: gitDirectory,
    GIT_WORK_TREE: root,
    GIT_INDEX_FILE: join(gitDirectory, "index"),
  }),
};

/**
 * The caller's environment without git's own variables. A test run under
 * `git rebase --exec` inherits `GIT_DIR` and its kin, which would point the
 * throwaway repository's set-up at the enclosing one.
 */
export function readEnvironmentWithoutGit(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        !entry[0].startsWith("GIT_") && entry[1] !== undefined,
    ),
  );
}

/**
 * Creates a repository in a temporary folder, with one commit by alice and a
 * linked worktree on a branch named side.
 */
export function makeRepository(): Repository {
  const root = mkdtempSync(join(tmpdir(), "throwaway-repository-"));
  const gitDirectory = join(root, ".git");
  const env = readEnvironmentWithoutGit();
  const git = (...args: string[]) => {
    const run = Bun.spawnSync(
      [
        "git",
        "-c",
        "user.name=alice",
        "-c",
        "user.email=alice@example.com",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: root, env },
    );
    if (run.exitCode !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
    }
    return run.stdout.toString();
  };
  git("init", "-q");
  writeFileSync(join(root, "notes.md"), "notes\n");
  git("add", "notes.md");
  git("commit", "-q", "-m", "notes");
  git("worktree", "add", "-q", "-b", "side", join(root, "side"));
  return {
    root,
    gitDirectory,
    linkedGitDirectory: join(gitDirectory, "worktrees", "side"),
    readState: () =>
      [
        git("rev-parse", "HEAD"),
        git("for-each-ref"),
        readFileSync(join(gitDirectory, "index")).toString("base64"),
        readFileSync(join(gitDirectory, "config"), "utf8"),
      ].join("\n"),
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}
