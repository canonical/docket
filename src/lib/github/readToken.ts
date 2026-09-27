import { execFile } from "node:child_process";
import { host } from "./constants.js";
import GitHubError from "./GitHubError.js";

/**
 * Asks `gh` for its token for github.com. `gh` applies its own order of
 * `GH_TOKEN`, `GITHUB_TOKEN` and the stored sign-in, and answers without
 * the network, so docket reads neither those variables nor gh's files.
 *
 * @note Impure: runs `gh`.
 * @throws GitHubError `GH_NOT_INSTALLED` when `gh` cannot be run, and
 * `GH_NOT_SIGNED_IN` when it has no token for github.com.
 */
export default function readToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("gh", ["auth", "token", "--hostname", host], (error, stdout) => {
      const token = String(stdout).trim();
      if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
        reject(
          new GitHubError(
            "GH_NOT_INSTALLED",
            "docket needs the GitHub CLI (gh).",
            "install it from https://cli.github.com, then run gh auth login",
          ),
        );
      } else if (error || token === "") {
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
    });
  });
}
