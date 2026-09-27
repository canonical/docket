import type { Repo } from "../lib/config/index.js";
import fail from "./fail.js";

/** A thread, or a stack, named by a watched repository's short name. */
export interface Reference {
  readonly repo: Repo;
  readonly number: number;
  /** Whether the number is a stack's rather than a thread's. */
  readonly stack: boolean;
  /** How many of the arguments the reference takes: one, or three. */
  readonly length: number;
  /** As written: `example#12` or `example stack 3`. */
  readonly text: string;
}

/**
 * Reads a reference as the arguments give it: `example#12` names a
 * thread, and `example stack 3`, three arguments, names a stack. The
 * short name is the one the configuration's `repos` gives.
 *
 * @throws Error `USAGE_MISSING_ARGUMENT` when no reference is given, and
 * `USAGE_INVALID_REFERENCE` when it is badly written or names no watched
 * repository.
 */
export default function parseReference(
  words: readonly string[],
  repos: readonly Repo[],
  command: string,
): Reference {
  const [first] = words;
  if (first === undefined) {
    fail(
      "USAGE_MISSING_ARGUMENT",
      `docket ${command} needs a reference, such as example#12.`,
      `run docket ${command} --help`,
    );
  }
  const thread = /^([^#\s]+)#(\d+)$/.exec(first);
  const stack =
    words[1] === "stack" && /^\d+$/.test(words[2] ?? "")
      ? [first, words[2]]
      : undefined;
  const [name, number] = thread ? [thread[1], thread[2]] : (stack ?? []);
  const repo = repos.find((entry) => entry.name === name);
  if (!repo || number === undefined) {
    const known = repos.map((entry) => entry.name).join(", ") || "none";
    fail(
      "USAGE_INVALID_REFERENCE",
      `\`${words.slice(0, 3).join(" ")}\` names no thread of a watched repository; the short names are: ${known}.`,
      `write the reference as <repo>#<number>, such as ${repos[0]?.name ?? "example"}#12`,
    );
  }
  return {
    repo,
    number: Number(number),
    stack: !thread,
    length: thread ? 1 : 3,
    text: thread ? first : `${repo.name} stack ${number}`,
  };
}
