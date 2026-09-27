import GitHubError from "./GitHubError.js";

/** The parts of Octokit's errors that are read; none holds the token. */
interface Failure {
  readonly status?: number;
  readonly message?: string;
  readonly response?: {
    readonly headers?: Readonly<Record<string, string | number | undefined>>;
  };
  readonly errors?: readonly {
    readonly type?: string;
    readonly message?: string;
  }[];
}

const rateLimited = (failure: Failure): boolean =>
  failure.response?.headers?.["x-ratelimit-remaining"] === "0" ||
  /rate limit/i.test(failure.message ?? "") ||
  (failure.errors ?? []).some(({ type }) => type === "RATE_LIMITED");

/**
 * Turns whatever a request threw into a `GitHubError`. The new error is
 * built from the status, the rate-limit headers and the message GraphQL
 * reports alone, and keeps no link to the original, whose request records
 * the headers sent.
 *
 * @param host The host the token was given for, such as `github.com`.
 */
export default function describeFailure(
  error: unknown,
  host: string,
): GitHubError {
  const failure = (error ?? {}) as Failure;
  if (failure.status === 401) {
    return new GitHubError(
      "GH_NOT_SIGNED_IN",
      `GitHub refused the token gh gave for ${host}.`,
      "run gh auth login",
    );
  }
  if (rateLimited(failure)) {
    const reset = Number(failure.response?.headers?.["x-ratelimit-reset"]);
    const at = reset ? new Date(reset * 1000).toISOString() : undefined;
    return new GitHubError(
      "GITHUB_RATE_LIMITED",
      `GitHub is refusing requests from this account${at ? ` until ${at}` : ""}, because its rate limit is reached.`,
      at
        ? `wait for the limit to reset at ${at}, then refresh`
        : "wait for the limit to reset, then refresh",
    );
  }
  const reported = failure.errors?.at(0)?.message;
  if (reported !== undefined) {
    // GraphQL answers an error in the body, such as a repository it
    // cannot find, and its message names the problem.
    return new GitHubError(
      "GITHUB_REQUEST_FAILED",
      `GitHub answered with an error: ${reported}`,
      "check that your gh account can read the repository, then refresh",
    );
  }
  if (failure.status !== undefined && failure.status < 500) {
    return new GitHubError(
      "GITHUB_REQUEST_FAILED",
      `GitHub refused a request with status ${failure.status}.`,
      "check that your gh account can read the repository, then refresh",
    );
  }
  return new GitHubError(
    "GITHUB_REQUEST_FAILED",
    "docket could not get an answer from GitHub.",
    "check the network connection and https://www.githubstatus.com, then refresh",
  );
}
