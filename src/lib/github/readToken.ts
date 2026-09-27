import { execFile } from "node:child_process";
import { host } from "./constants.js";
import GitHubError from "./GitHubError.js";

/**
 * How long `gh` may take to give its token, in milliseconds. It answers
 * without the network, but a token kept in a locked keyring can wait for
 * an unlock prompt that never shows.
 */
const timeout = 10_000;

/**
 * Asks `gh` for its token for github.com. `gh` applies its own order of
 * `GH_TOKEN`, `GITHUB_TOKEN` and the stored sign-in, and answers without
 * the network, so docket reads neither those variables nor gh's files.
 *
 * @note Impure: runs `gh`.
 * @throws GitHubError `GH_NOT_INSTALLED` when `gh` cannot be run, and
 * `GH_NOT_SIGNED_IN` when it has no token for github.com or gives none
 * in time.
 */
export default function readToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "gh",
      ["auth", "token", "--hostname", host],
      { timeout },
      (error, stdout) => {
        const token = String(stdout).trim();
        const failure = error as
          | (NodeJS.ErrnoException & { killed?: boolean })
          | null;
        if (failure?.code === "ENOENT") {
          reject(
            new GitHubError(
              "GH_NOT_INSTALLED",
              "docket needs the GitHub CLI (gh).",
              "install it from https://cli.github.com, then run gh auth login",
            ),
          );
        } else if (failure?.killed) {
          reject(
            new GitHubError(
              "GH_NOT_SIGNED_IN",
              `gh gave no token for ${host} within ${timeout / 1000} seconds.`,
              "run gh auth status, and unlock the keyring if it asks",
            ),
          );
        } else if (failure || token === "") {
          reject(
            new GitHubError(
              "GH_NOT_SIGNED_IN",
              `gh is not signed in to ${host}.`,
              "run gh auth login",
            ),
          );
        } else {
          resolve(token);
        }
      },
    );
  });
}
