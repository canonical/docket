import { describeAge } from "../activity/index.js";
import type { WaitRow } from "../owed/index.js";
import type { Reviewer, ThreadDetail } from "../provider/index.js";
import type { Thread } from "../waits/index.js";
import { kindWords, quotedNote } from "./constants.js";
import describeDataAge from "./describeDataAge.js";
import describeStack from "./describeStack.js";
import describeTime from "./describeTime.js";
import describeWaitData from "./describeWaitData.js";
import quote from "./quote.js";
import quoteLines from "./quoteLines.js";
import renderFreshness from "./renderFreshness.js";
import renderWaitRow from "./renderWaitRow.js";
import sanitize from "./sanitize.js";
import type { Detail, Format, Freshness } from "./types.js";

/** One thread as `show` prints it: its facts, its details and its waits. */
export interface ShownThread {
  /** `example#12`. */
  readonly reference: string;
  /** The short name of its repository. */
  readonly repo: string;
  readonly thread: Thread;
  readonly details: ThreadDetail;
  /** Its running waits, most overdue first. */
  readonly rows: readonly WaitRow[];
}

/** What `show` prints, and how. */
export interface ThreadAnswer {
  /** What was asked for, such as `example#12` or `example stack 3`. */
  readonly reference: string;
  readonly threads: readonly ShownThread[];
  readonly freshness: Freshness;
  readonly format: Format;
  readonly detail: Detail;
}

const nameReviewer = (reviewer: Reviewer) =>
  sanitize("team" in reviewer ? reviewer.team : reviewer.login);

const describeCount = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * The checks on a pull request's head commit: their combined state, then
 * the failing ones by name, or every one at the detailed level.
 */
function describeChecks(details: ThreadDetail, detail: Detail): string {
  const hasCheck = (state: string) =>
    details.checks.some((check) => check.state === state);
  const state = hasCheck("failing")
    ? "failing"
    : hasCheck("running")
      ? "running"
      : "passing";
  const named = details.checks.filter(
    (check) => detail === "detailed" || check.state === "failing",
  );
  const names = named.map(
    ({ name, state: each }) => `${sanitize(name)} ${each}`,
  );
  return names.length > 0
    ? `checks ${state}: ${names.join(", ")}`
    : `checks ${state}`;
}

/**
 * The facts of a thread in words, each on its own line, for both a person
 * and an agent; an agent reads GitHub's text quoted.
 */
function describeFacts(
  shown: ShownThread,
  formatWhen: (at: Date) => string,
  detail: Detail,
  llm: boolean,
): string[] {
  const { thread, details, repo } = shown;
  const formatText = (value: string) => (llm ? quote(value) : sanitize(value));
  const assignees = thread.assignees.map(({ login }) => sanitize(login));
  const { stack } = thread;
  const describeNeighbour = (side: string, position: number) => {
    const entry = details.stack?.find((member) => member.position === position);
    return entry ? [`${side} #${entry.number} ${entry.state}`] : [];
  };
  const neighbours = stack
    ? [
        ...describeNeighbour("below", stack.position - 1),
        ...describeNeighbour("above", stack.position + 1),
      ]
    : [];
  const added = details.files.reduce((sum, file) => sum + file.additions, 0);
  const removed = details.files.reduce((sum, file) => sum + file.deletions, 0);
  const pull = thread.kind === "pullRequest";
  return [
    `title ${formatText(thread.title)}`,
    `${kindWords[thread.kind]}${thread.draft ? ", draft" : ""}, opened by ${sanitize(thread.author.login)} ${formatWhen(thread.createdAt)}`,
    `assignees ${assignees.join(", ") || "none"}`,
    ...(detail === "summary"
      ? []
      : [
          `labels ${thread.labels.map(formatText).join(", ") || "none"}`,
          `updated ${formatWhen(details.updatedAt)}`,
          ...(pull && details.checks.length > 0
            ? [describeChecks(details, detail)]
            : []),
          ...(stack
            ? [
                [
                  `${describeStack(repo, stack)}, onto ${sanitize(stack.base)}`,
                  ...neighbours,
                ].join(", "),
              ]
            : []),
          ...(pull
            ? [
                `files changed ${details.files.length}, ${describeCount(added, "line")} added, ${describeCount(removed, "line")} removed`,
              ]
            : []),
          ...(detail === "detailed"
            ? details.files.map(
                ({ path, additions, deletions }) =>
                  `file ${formatText(path)}, ${additions} added, ${deletions} removed`,
              )
            : []),
        ]),
  ];
}

/** The reviews requested, oldest first, and the messages to show. */
function describeTalk(shown: ShownThread, detail: Detail) {
  const { requests, messages } = shown.details;
  const latest = messages.at(-1);
  return {
    requests: detail === "summary" ? [] : requests,
    messages:
      detail === "detailed"
        ? messages
        : detail === "standard" && latest
          ? [latest]
          : [],
  };
}

function renderText(shown: ShownThread, answer: ThreadAnswer): string {
  const { freshness, detail, format } = answer;
  const llm = format === "llm";
  const { now, timezone } = freshness;
  const formatWhen = (at: Date) =>
    `${describeTime(at, timezone)}, ${describeAge(at, now)} ago`;
  const facts = describeFacts(shown, formatWhen, detail, llm);
  const { requests, messages } = describeTalk(shown, detail);
  const formatHeading = (text: string) => (llm ? `### ${text}` : text);
  const waits = shown.rows.flatMap((row) =>
    renderWaitRow(row, llm ? "llm" : "plain", timezone, detail),
  );
  const sections = [
    [
      llm ? `## ${shown.reference}` : shown.reference,
      ...facts.map((fact) => (llm ? `- ${fact}` : `  ${fact}`)),
    ],
    [formatHeading("waits"), ...(waits.length > 0 ? waits : ["nothing owed"])],
    ...(requests.length > 0
      ? [
          [
            formatHeading("reviews requested"),
            ...requests.map(
              ({ reviewer, requester, at }) =>
                `${llm ? "- " : "  "}${sanitize(requester.login)} asked ${nameReviewer(reviewer)}, ${formatWhen(at)}`,
            ),
          ],
        ]
      : []),
    ...messages.map(({ author, at, body }) => [
      formatHeading(
        `message from ${sanitize(author.login)}, ${formatWhen(at)}`,
      ),
      llm
        ? quoteLines(body)
        : sanitize(body, true)
            .split("\n")
            .map((line) => `  ${line}`.trimEnd())
            .join("\n"),
    ]),
  ];
  return sections.map((section) => section.join("\n")).join("\n\n");
}

function describeThreadData(shown: ShownThread, detail: Detail) {
  const { thread, details } = shown;
  const { requests, messages } = describeTalk(shown, detail);
  const full = detail !== "summary";
  return {
    reference: shown.reference,
    title: sanitize(thread.title),
    kind: thread.kind,
    draft: thread.draft,
    author: sanitize(thread.author.login),
    openedAt: thread.createdAt.toISOString(),
    assignees: thread.assignees.map(({ login }) => sanitize(login)),
    ...(full
      ? {
          labels: thread.labels.map((label) => sanitize(label)),
          updatedAt: details.updatedAt.toISOString(),
          checks: details.checks.map(({ name, state }) => ({
            name: sanitize(name),
            state,
          })),
          stack: thread.stack
            ? { ...thread.stack, members: details.stack ?? [] }
            : null,
          files: details.files.map((file) => ({
            ...file,
            path: sanitize(file.path),
          })),
        }
      : {}),
    waits: shown.rows.map((row) => describeWaitData(row, detail)),
    requests: requests.map(({ reviewer, requester, at }) => ({
      reviewer: nameReviewer(reviewer),
      requester: sanitize(requester.login),
      at: at.toISOString(),
    })),
    messages: messages.map(({ author, at, body }) => ({
      author: sanitize(author.login),
      at: at.toISOString(),
      body: sanitize(body, true),
    })),
  };
}

/**
 * Writes `show`: each thread asked for, untrimmed, with its waits, the
 * reviews requested and its messages. `summary` gives its title, kind,
 * assignees and waits; `standard` adds its labels, checks, stack, files
 * and latest message; `detailed` adds every check, every file and every
 * message the details hold. An agent reads every message as quoted data.
 */
export default function renderThread(answer: ThreadAnswer): string {
  const { reference, threads, freshness, format, detail } = answer;
  if (format === "json") {
    const data = {
      reference,
      data: describeDataAge(freshness),
      threads: threads.map((shown) => describeThreadData(shown, detail)),
    };
    return `${JSON.stringify(data, null, 2)}\n`;
  }
  const llm = format === "llm";
  const head = [
    llm ? `# show ${reference}` : `show ${reference}`,
    ...renderFreshness(freshness, format),
    ...(llm ? [quotedNote] : []),
  ].join("\n");
  const bodies = threads.map((shown) => renderText(shown, answer));
  return `${[head, ...bodies].join("\n\n")}\n`;
}
