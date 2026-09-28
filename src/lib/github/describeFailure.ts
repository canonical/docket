import { requestTimeout } from "./constants.js";
import GitHubError from "./GitHubError.js";

/** The parts of Octokit's errors that are read; none holds the token. */
interface Failure {
  readonly status?: number;
  readonly message?: string;
  /** What `fetch` threw, when the request got no answer. */
  readonly cause?: { readonly name?: string };
  readonly response?: {
    readonly headers?: Readonly<Record<string, string | number | undefined>>;
    /** The body of a REST answer, which names why GitHub refused. */
    readonly data?: {
      readonly message?: unknown;
      readonly errors?: readonly { readonly message?: unknown }[];
    };
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
 * Why GitHub refused, as its REST answer words it: the message, then each
 * detail the answer lists, or nothing when it words none.
 */
const readRefusal = (failure: Failure): string | undefined => {
  const data = failure.response?.data;
  const words = [
    data?.message,
    ...(data?.errors ?? []).map((error) => error.message),
  ].filter((part): part is string => typeof part === "string" && part !== "");
  const [message, ...details] = words;
  if (message === undefined) return undefined;
  return details.length > 0 ? `${message}: ${details.join("; ")}` : message;
};

/**
 * Turns whatever a request threw into a `GitHubError`. The new error is
 * built from the status, the rate-limit headers and the message GitHub
 * answers alone, and keeps no link to the original, whose request records
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
        ? { step: `wait for the limit to reset at ${at}` }
        : { step: "wait for the limit to reset" },
    );
  }
  if (failure.cause?.name === "TimeoutError") {
    return new GitHubError(
      "GITHUB_TIMED_OUT",
      `GitHub gave no answer within ${requestTimeout / 1000} seconds.`,
      { step: "check the network connection and https://www.githubstatus.com" },
    );
  }
  if (failure.cause?.name === "TypeError") {
    // `fetch` throws a TypeError when the request gets no answer at all:
    // the name does not resolve, or the connection is refused.
    return new GitHubError(
      "GITHUB_UNREACHABLE",
      `docket could not reach ${host}: the request got no answer.`,
      { step: "check the network connection and https://www.githubstatus.com" },
    );
  }
  const reported = failure.errors?.at(0)?.message;
  if (reported !== undefined) {
    // GraphQL answers an error in the body, such as a repository it
    // cannot find, and its message names the problem.
    return new GitHubError(
      "GITHUB_REQUEST_FAILED",
      `GitHub answered with an error: ${reported}`,
      { step: "check that your gh account can read the repository" },
    );
  }
  const refusal = failure.status === 422 && readRefusal(failure);
  if (refusal) {
    // GitHub answers 422 when it will not make the change asked for, such
    // as reviews requested from someone who is not a collaborator, and its
    // answer names why.
    return new GitHubError(
      "GITHUB_REQUEST_FAILED",
      `GitHub refused the request: ${/[.?!]$/.test(refusal) ? refusal : `${refusal}.`}`,
      { step: "change what GitHub's reason names" },
    );
  }
  if (failure.status !== undefined && failure.status < 500) {
    return new GitHubError(
      "GITHUB_REQUEST_FAILED",
      `GitHub refused a request with status ${failure.status}.`,
      { step: "check that your gh account can read the repository" },
    );
  }
  return new GitHubError(
    "GITHUB_REQUEST_FAILED",
    "docket could not get an answer from GitHub.",
    { step: "check the network connection and https://www.githubstatus.com" },
  );
}
