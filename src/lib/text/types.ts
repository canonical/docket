import type { CacheErrorCode } from "../cache/index.js";
import type { ConfigErrorCode } from "../config/index.js";
import type { Budgets, ProviderErrorCode } from "../provider/index.js";

/** Where the output goes decides its form: a person, an agent or a program. */
export type Format = "plain" | "llm" | "json";

/** How much each item shows. */
export type Detail = "summary" | "standard" | "detailed";

/** The commands docket answers. */
export type CommandName =
  | "owed"
  | "activity"
  | "show"
  | "assign"
  | "review"
  | "config";

/**
 * A flag a command takes, as its help describes it. A flag either takes a
 * value or is a switch, on when given and off when left out, such as
 * `--confirm`. What applies when a flag with a value is left out is one
 * value, `default`, or, when that depends on the call, a sentence,
 * `fallback`: the help prints whichever the flag has.
 */
export type Flag = {
  /** The flag without its dashes, such as `max-age`. */
  readonly name: string;
  /** One sentence saying what the flag changes. */
  readonly description: string;
} & (
  | ({
      /** What the value is, such as `seconds`. */
      readonly value: string;
      /** The only values accepted, when the set is closed. */
      readonly choices?: readonly string[];
    } & (
      | { readonly default: string; readonly fallback?: undefined }
      | { readonly fallback: string; readonly default?: undefined }
    ))
  | {
      readonly value?: undefined;
      readonly choices?: undefined;
      readonly default?: undefined;
      readonly fallback?: undefined;
    }
);

/** A command, with everything its help says. */
export interface Command {
  readonly name: CommandName;
  /** The arguments after the command's name, such as `<reference>`. */
  readonly arguments: string;
  /** One sentence: the question the command answers. */
  readonly answers: string;
  /** What else a reader needs to use it well, in a few sentences. */
  readonly notes: readonly string[];
  readonly flags: readonly Flag[];
  /** One call, as it would be typed. */
  readonly example: string;
  /** What each exit code means for this command, by code. */
  readonly exits: Readonly<Record<0 | 2 | 3, string>>;
}

/**
 * The named codes of the text interface's own errors. This is the one
 * list of them. Callers and scripts depend on the codes, so a code is
 * never renamed or reused.
 */
export type TextErrorCode =
  /** The first word is not a command. */
  | "USAGE_UNKNOWN_COMMAND"
  /** A flag the command does not take. */
  | "USAGE_UNKNOWN_FLAG"
  /** A flag's value, or an argument, outside what it accepts. */
  | "USAGE_INVALID_VALUE"
  /** An argument the command needs is missing. */
  | "USAGE_MISSING_ARGUMENT"
  /** A reference that names no watched repository, or is badly written. */
  | "USAGE_INVALID_REFERENCE"
  /** No open thread answers to the reference. */
  | "THREAD_NOT_FOUND"
  /** An argument the command does not take, beyond those it does. */
  | "USAGE_UNEXPECTED_ARGUMENT"
  /**
   * A failure no other code names, such as a defect: the last resort, so
   * that every stop prints a code and a recovery step.
   */
  | "UNEXPECTED_FAILURE"
  /** The thread cannot take the change, such as reviewers on an issue. */
  | "THREAD_KIND_UNSUPPORTED"
  /** GitHub applied only part of a change. */
  | "WRITE_INCOMPLETE";

/** Every named code a user can meet, whichever domain names it. */
export type ErrorCode =
  | TextErrorCode
  | ProviderErrorCode
  | CacheErrorCode
  | ConfigErrorCode;

/** Something that stopped an answer, or weakens it, and how to fix it. */
export interface Problem {
  readonly code: ErrorCode;
  /** One sentence naming the problem. */
  readonly message: string;
  /** What to do so the next call works. */
  readonly recovery: string;
}

/** How old the data behind an answer is, and what weakens it. */
export interface Freshness {
  /** The instant the answer is given at. */
  readonly now: Date;
  /** When the data was last synced; absent when no repository is watched. */
  readonly syncedAt: Date | undefined;
  /** The time zone absolute times are written in. */
  readonly timezone: string;
  /**
   * What stopped a fetch while cached data could still answer, such as a
   * rate limit.
   */
  readonly warnings: readonly Problem[];
  /**
   * GitHub's budgets, as the mirror every docket process shares gives
   * them: the queries' is said when it runs low, and a program reads both.
   */
  readonly budget: Budgets;
}
