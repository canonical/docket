/**
 * The caller's environment without git's own variables. Git exports
 * `GIT_DIR`, `GIT_INDEX_FILE` and their kin into the commands it runs, as
 * under `git rebase --exec`, and a caller may set them. Left in place, they
 * point git, and any tool that runs git, at the enclosing repository instead
 * of a scratch one: `git init` changes its config, and a commit lands in it.
 * The environment is read on each call, so the result follows the caller's.
 */
export default function readEnvironmentWithoutGit(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        !entry[0].startsWith("GIT_") && entry[1] !== undefined,
    ),
  );
}
