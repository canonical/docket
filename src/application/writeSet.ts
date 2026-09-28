import type { Cache } from "../lib/cache/index.js";
import type {
  Provider,
  ProviderError,
  Reviewer,
} from "../lib/provider/index.js";
import { type Format, type Problem, quote } from "../lib/text/index.js";
import type { Thread } from "../lib/waits/index.js";
import isAssignable from "./isAssignable.js";
import isNamedError from "./isNamedError.js";
import nameReviewer from "./nameReviewer.js";

/** The two sets docket writes: a thread's assignees and its review requests. */
export type WriteAction = "assign" | "review";

/** One change to a thread's set, as a face asks for it. */
export interface WriteRequest {
  readonly action: WriteAction;
  /**
   * An issue or pull request to assign, or a pull request to review: the
   * face refuses any other before asking.
   */
  readonly thread: Thread;
  /** The thread as the face names it, such as `example#12`. */
  readonly reference: string;
  /** The whole set wanted: logins, and for a review `org/team` names too. */
  readonly wanted: readonly string[];
  /** False to read the set GitHub records and change nothing. */
  readonly apply: boolean;
  /** How the names in a shortfall read: quoted for an agent in `llm`. */
  readonly format: Format;
  /** How the face says to retry, such as `run the command again`. */
  readonly retry: string;
}

/** What a write found and did. */
export interface WriteOutcome {
  /** The set GitHub recorded before the write. */
  readonly current: readonly string[];
  /**
   * The set GitHub records after the write, as it answered it. Absent when
   * nothing was sent: only a plan was asked for, or the set was already
   * the one wanted.
   */
  readonly applied?: readonly string[];
  /** Why the cache could not refresh the thread after the change was made. */
  readonly warning?: Problem;
  /** `WRITE_INCOMPLETE`, when GitHub records a set other than the one asked for. */
  readonly shortfall?: Problem;
}

/** What a write reaches: GitHub, and the cache that holds its threads. */
export interface WriteTarget {
  readonly provider: Provider;
  readonly cache: Cache;
}

/**
 * A provider's recovery that ends by refreshing, the terminal's way to try
 * again, carries the part before it as `step`. An open editor and text
 * mode each try again their own way, so the error thrown ends `step` with
 * `retry` instead, and keeps `step` for the face that reads it. Any other
 * failure goes through as it is, whatever its recovery's wording.
 */
const retryWith =
  (retry: string) =>
  (error: unknown): never => {
    if (!isNamedError(error)) throw error;
    const { step } = error as Partial<ProviderError>;
    if (typeof step !== "string") throw error;
    const { code, message } = error;
    throw Object.assign(new Error(message), {
      code,
      recovery: `${step}, then ${retry}`,
      step,
    });
  };

/** `org/team` names a team; anything else a person. */
const readReviewer = (name: string): Reviewer =>
  name.includes("/") ? { team: name } : { login: name, type: "user" };

const lowerNames = (names: readonly string[]) =>
  new Set(names.map((name) => name.toLowerCase()));

/** Whether two sets of names are the same, ignoring case as GitHub does. */
const isSameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  [...lowerNames(a)].every((name) => lowerNames(b).has(name));

/**
 * Writes a thread's whole set of assignees or review requests, the one
 * way both faces write: it plans from the set GitHub holds, never
 * from the cache, which can be as old as its maximum age, so a plan from
 * it could skip a change or undo one made since. A change that alters
 * nothing is never sent. After a change, the cache refreshes the thread's
 * repository, so every face reads the change rather than a copy from
 * before it, and the set GitHub answers is checked against the one asked
 * for.
 *
 * @note Impure: reads GitHub, writes the change to it when asked to
 * apply, and refreshes the cache after it.
 * @throws ProviderError when GitHub refuses the change or a read, its
 * recovery ending with `retry` when the provider's ends by refreshing.
 */
export default async function writeSet(
  { provider, cache }: WriteTarget,
  request: WriteRequest,
): Promise<WriteOutcome> {
  const { action, thread, reference, wanted, apply, format, retry } = request;
  const fail = retryWith(retry);
  const current =
    action === "assign" && isAssignable(thread)
      ? (await provider.readAssignees(thread).catch(fail)).map(
          ({ login }) => login,
        )
      : (await provider.reviewCandidates(thread).catch(fail)).requested.map(
          nameReviewer,
        );
  if (!apply || isSameSet(current, wanted)) return { current };
  const applied =
    action === "assign" && isAssignable(thread)
      ? (await provider.setAssignees(thread, wanted).catch(fail)).map(
          ({ login }) => login,
        )
      : (
          await provider
            .setReviewers(thread, wanted.map(readReviewer))
            .catch(fail)
        ).map(nameReviewer);
  // The change is made whatever the refresh meets, so a failure is only a
  // warning.
  let warning: Problem | undefined;
  try {
    await cache.refreshRepo(thread.repo);
  } catch (error) {
    if (!isNamedError(error)) throw error;
    const { code, message, recovery } = error;
    warning = { code, message, recovery };
  }
  // The set is written whole, so it falls short both when GitHub leaves
  // out a name asked for and when it keeps one that was to go.
  const recorded = lowerNames(applied);
  const asked = lowerNames(wanted);
  const left = wanted.filter((name) => !recorded.has(name.toLowerCase()));
  const kept = applied.filter((name) => !asked.has(name.toLowerCase()));
  const outcome = { current, applied, ...(warning && { warning }) };
  if (left.length === 0 && kept.length === 0) return outcome;
  // A login or team name reads as quoted data for an agent.
  const formatNames = (names: readonly string[]) =>
    names.map((name) => (format === "llm" ? quote(name) : name)).join(", ");
  const shortfalls = [
    ...(left.length > 0 ? [`did not record ${formatNames(left)}`] : []),
    ...(kept.length > 0 ? [`still records ${formatNames(kept)}`] : []),
  ];
  const able = action === "assign" ? "assigned" : "asked for a review";
  return {
    ...outcome,
    shortfall: {
      code: "WRITE_INCOMPLETE",
      message: `GitHub ${shortfalls.join(" and ")} on ${reference}.`,
      recovery:
        left.length > 0
          ? `check that ${formatNames(left)} can be ${able} in ${thread.repo}, then ${retry}`
          : `run docket show ${reference} to see whom GitHub records, then ${retry}`,
    },
  };
}
