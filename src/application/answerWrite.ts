import type { Assignable, Reviewer } from "../lib/provider/index.js";
import { quote, renderPlan, renderProblems } from "../lib/text/index.js";
import type { Thread } from "../lib/waits/index.js";
import fail from "./fail.js";
import findThreads from "./findThreads.js";
import parseReference from "./parseReference.js";
import readThreads from "./readThreads.js";
import type { Session } from "./types.js";

const nameReviewer = (reviewer: Reviewer) =>
  "team" in reviewer ? reviewer.team : reviewer.login;

/** Whether a thread can have assignees: discussions have none. */
const isAssignable = (thread: Thread): thread is Thread & Assignable =>
  thread.kind !== "discussion";

/** `org/team` names a team; anything else a person. */
const readReviewer = (name: string): Reviewer =>
  name.includes("/") ? { team: name } : { login: name, type: "user" };

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
 * on `--confirm`, and prints the plan or its result.
 */
export default async function answerWrite(session: Session): Promise<number> {
  const { context, invocation, watched, provider } = session;
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
  const current =
    command === "assign"
      ? thread.assignees.map(({ login }) => login)
      : (await provider.reviewCandidates(thread)).requested.map(nameReviewer);
  const plan = {
    action: command === "assign" ? "assign" : "review",
    reference: reference.text,
    current,
    wanted,
    freshness: session.describeFreshness(syncedAt, warnings),
    format,
  } as const;
  const lowerNames = (names: readonly string[]) =>
    new Set(names.map((name) => name.toLowerCase()));
  const isSameSet = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length &&
    [...lowerNames(a)].every((name) => lowerNames(b).has(name));
  if (!confirm || isSameSet(current, wanted)) {
    context.write(renderPlan(plan));
    return 0;
  }
  const applied =
    command === "assign" && isAssignable(thread)
      ? (await provider.setAssignees(thread, wanted)).map(({ login }) => login)
      : (await provider.setReviewers(thread, wanted.map(readReviewer))).map(
          nameReviewer,
        );
  context.write(renderPlan({ ...plan, applied }));
  // The set is written whole, so it falls short both when GitHub leaves
  // out a name asked for and when it keeps one that was to go.
  const recorded = lowerNames(applied);
  const asked = lowerNames(wanted);
  const left = wanted.filter((name) => !recorded.has(name.toLowerCase()));
  const kept = applied.filter((name) => !asked.has(name.toLowerCase()));
  if (left.length === 0 && kept.length === 0) return 0;
  // A login or team name reads as quoted data for an agent, as in the plan.
  const formatNames = (names: readonly string[]) =>
    names.map((name) => (format === "llm" ? quote(name) : name)).join(", ");
  const shortfalls = [
    ...(left.length > 0 ? [`did not record ${formatNames(left)}`] : []),
    ...(kept.length > 0 ? [`still records ${formatNames(kept)}`] : []),
  ];
  context.writeError(
    renderProblems(
      [
        {
          code: "WRITE_INCOMPLETE",
          message: `GitHub ${shortfalls.join(" and ")} on ${reference.text}.`,
          recovery:
            left.length > 0
              ? `check that ${formatNames(left)} can be ${command === "assign" ? "assigned" : "asked for a review"} in ${reference.repo.repo}, then run the command again`
              : `run docket show ${reference.text} to see whom GitHub records, then run the command again`,
        },
      ],
      format,
    ),
  );
  return 3;
}
