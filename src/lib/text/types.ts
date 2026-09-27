/** Where the output goes decides its form: a person, an agent or a program. */
export type Format = "plain" | "llm" | "json";

/** How much each item shows. */
export type Detail = "summary" | "standard" | "detailed";

/** The commands docket answers. */
export type CommandName = "owed" | "activity" | "show" | "config";

/** A flag a command takes, as its help describes it. */
export interface Flag {
  /** The flag without its dashes, such as `max-age`. */
  readonly name: string;
  /** What the value is, such as `seconds`. */
  readonly value: string;
  /** The only values accepted, when the set is closed. */
  readonly choices?: readonly string[];
  /** What applies when the flag is left out, as the help writes it. */
  readonly fallback: string;
  /** One sentence saying what the flag changes. */
  readonly description: string;
}

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
