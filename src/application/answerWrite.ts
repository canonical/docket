import { renderPlan, renderProblems } from "../lib/text/index.js";
import fail from "./fail.js";
import findThreads from "./findThreads.js";
import isAssignable from "./isAssignable.js";
import parseReference from "./parseReference.js";
import readThreads from "./readThreads.js";
import type { Session } from "./types.js";
import writeSet from "./writeSet.js";

/** A GitHub login: letters, digits and single hyphens, 39 at most. */
const loginShape = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/;

/** A team as `org/team`: the organisation's login, then the team's slug. */
const teamShape = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}\/[A-Za-z0-9][\w-]*$/;

/**
 * Answers `docket assign` and `docket review`, plan first: without
 * `--confirm` it prints the change it would make and changes nothing;
 * with it, it sets the whole set asked for and prints what GitHub then
 * records. A plan that changes nothing is never sent.
 *
 * @returns 3 when GitHub records a set other than the one asked for, with
 * `WRITE_INCOMPLETE`; a refusal throws the provider's error.
 *
 * @note Impure: reads the cache and GitHub, writes the change to GitHub
 * on `--confirm` and refreshes the cache after it, and prints the plan
 * or its result.
 */
export default async function answerWrite(session: Session): Promise<number> {
  const { context, invocation, watched, provider, cache } = session;
  const { command, positionals, format, confirm } = invocation;
  const reference = parseReference(positionals, watched, command);
  const recovery = `run docket ${command} --help`;
  if (reference.stack) {
    fail(
      "USAGE_INVALID_REFERENCE",
      `docket ${command} changes one thread, and ${reference.text} names a stack.`,
      recovery,
    );
  }
  const wanted = positionals.slice(1);
  if (wanted.length === 0) {
    const who = command === "assign" ? "login" : "login or org/team";
    fail(
      "USAGE_MISSING_ARGUMENT",
      `docket ${command} needs at least one ${who} after the reference.`,
      recovery,
    );
  }
  // Only a name GitHub could give passes: a login, and for a review an
  // `org/team` name. A space, quote or shell character would otherwise
  // change the command the plan prints for applying it.
  const isName = (name: string) =>
    loginShape.test(name) || (command === "review" && teamShape.test(name));
  const invalid = wanted.find((name) => !isName(name));
  if (invalid !== undefined) {
    const who = command === "assign" ? "a login" : "a login or an org/team";
    fail(
      "USAGE_INVALID_VALUE",
      `\`${invalid}\` is not ${who} as GitHub writes one.`,
      recovery,
    );
  }
  const { threads, syncedAt, warnings } = await readThreads(session);
  const [thread] = findThreads(threads, reference);
  const allowed =
    command === "assign" ? isAssignable(thread) : thread.kind === "pullRequest";
  if (!allowed) {
    fail(
      "THREAD_KIND_UNSUPPORTED",
      command === "assign"
        ? `${reference.text} is a discussion, and discussions have no assignees.`
        : `${reference.text} is not a pull request, so no review can be requested on it.`,
      `run docket show ${reference.text} to see the thread`,
    );
  }
  const action = command === "assign" ? "assign" : "review";
  const { current, applied, warning, shortfall } = await writeSet(
    { provider, cache },
    {
      action,
      thread,
      reference: reference.text,
      wanted,
      apply: confirm,
      format,
      retry: "run the command again",
    },
  );
  context.write(
    renderPlan({
      action,
      reference: reference.text,
      current,
      wanted,
      freshness: session.describeFreshness(syncedAt, warnings),
      format,
      ...(applied && { applied }),
    }),
  );
  if (warning) {
    context.writeError(renderProblems([warning], format, "Warning"));
  }
  if (!shortfall) return 0;
  context.writeError(renderProblems([shortfall], format));
  return 3;
}
