import { parseArgs } from "node:util";
import {
  type CommandName,
  catalogue,
  details,
  formats,
} from "../lib/text/index.js";
import fail from "./fail.js";
import type { Invocation } from "./types.js";

/** What the arguments ask for: help, the version, or a command. */
export type Request =
  | { readonly kind: "help"; readonly command: CommandName | undefined }
  | { readonly kind: "version" }
  | { readonly kind: "command"; readonly invocation: Invocation };

/** The flags any command may take; each command's list narrows them. */
const options = {
  by: { type: "string" },
  window: { type: "string" },
  format: { type: "string" },
  detail: { type: "string" },
  "max-age": { type: "string" },
  help: { type: "boolean" },
  version: { type: "boolean" },
} as const;

/** The seconds of `--max-age` when none is given. */
const defaultMaxAge = "300";

/**
 * Splits the arguments into flags and the words around them, refusing a
 * flag docket does not know or a value a flag cannot take.
 */
function read(args: readonly string[]) {
  try {
    return parseArgs({
      args: [...args],
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    const flag = /'(-[^'\s]*)/.exec((error as Error).message)?.[1] ?? "";
    if (
      (error as NodeJS.ErrnoException).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION"
    ) {
      fail(
        "USAGE_UNKNOWN_FLAG",
        `docket has no flag \`${flag}\`.`,
        "run docket --help",
      );
    }
    fail(
      "USAGE_INVALID_VALUE",
      `The flag \`${flag}\` is given without the value it needs, or with one it does not take.`,
      "run docket --help",
    );
  }
}

/**
 * Reads the arguments against the command catalogue: the command, its
 * arguments and its flags, each flag's value checked against the values
 * the catalogue allows. `docket` alone asks for owed.
 *
 * @param interactive Whether a terminal shows the output, which decides
 * the format when `--format` is not given.
 * @throws Error `USAGE_*` when the call is not valid.
 */
export default function parseArguments(
  args: readonly string[],
  interactive: boolean,
): Request {
  const { values, positionals } = read(args);
  const [first, ...rest] = positionals;
  const command = catalogue.find(({ name }) => name === (first ?? "owed"));
  if (!command) {
    fail(
      "USAGE_UNKNOWN_COMMAND",
      `docket has no command \`${first}\`.`,
      "run docket --help",
    );
  }
  if (values.help) {
    return {
      kind: "help",
      command: first === undefined ? undefined : command.name,
    };
  }
  if (values.version) return { kind: "version" };
  const recovery = `run docket ${command.name} --help`;
  if (command.arguments === "" && rest.length > 0) {
    fail(
      "USAGE_INVALID_VALUE",
      `docket ${command.name} takes no arguments, and was given \`${rest.join(" ")}\`.`,
      recovery,
    );
  }
  for (const name of Object.keys(values)) {
    if (!command.flags.some((flag) => flag.name === name)) {
      fail(
        "USAGE_UNKNOWN_FLAG",
        `docket ${command.name} takes no flag \`--${name}\`.`,
        recovery,
      );
    }
  }
  for (const flag of command.flags) {
    const value = values[flag.name as keyof typeof values];
    if (
      typeof value === "string" &&
      flag.choices &&
      !flag.choices.includes(value)
    ) {
      fail(
        "USAGE_INVALID_VALUE",
        `\`--${flag.name}\` takes ${flag.choices.join(", ")}, not \`${value}\`.`,
        recovery,
      );
    }
  }
  const seconds = values["max-age"] ?? defaultMaxAge;
  if (!/^\d+$/.test(seconds)) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--max-age\` takes a whole number of seconds, not \`${seconds}\`.`,
      recovery,
    );
  }
  return {
    kind: "command",
    invocation: {
      command: command.name,
      positionals: rest,
      // Each value has been checked against the catalogue's choices.
      format:
        formats.find((entry) => entry === values.format) ??
        (interactive ? "plain" : "llm"),
      detail: details.find((entry) => entry === values.detail) ?? "standard",
      maxAge: Number(seconds) * 1000,
      by: values.by,
      window: values.window,
    },
  };
}
