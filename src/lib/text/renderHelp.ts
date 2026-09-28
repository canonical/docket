import catalogue from "./catalogue.js";
import type { Command, CommandName, Flag } from "./types.js";

const formatUsage = (flag: Flag) => {
  const value = flag.choices?.join("|") ?? (flag.value && `<${flag.value}>`);
  return value ? `--${flag.name} ${value}` : `--${flag.name}`;
};

const formatSignature = ({ name, arguments: parts }: Command) =>
  parts === "" ? `docket ${name}` : `docket ${name} ${parts}`;

const describeFlag = (flag: Flag) => {
  const said = flag.fallback ?? flag.default;
  const fallback = said === undefined ? "" : ` Default: ${said}.`;
  return [`  ${formatUsage(flag)}`, `      ${flag.description}${fallback}`];
};

const describeExits = (exits: Command["exits"]) =>
  ([0, 2, 3] as const).map((code) => `  ${code}  ${exits[code]}`);

/**
 * Writes the help, drawn from the command catalogue: docket's own, which
 * lists every command, or one command's, with what it answers, its flags
 * and their defaults, one example and its exit codes.
 */
export default function renderHelp(name?: CommandName): string {
  const command = catalogue.find((entry) => entry.name === name);
  if (command) {
    const flags = command.flags
      .map((flag) => `[${formatUsage(flag)}]`)
      .join(" ");
    return [
      `Usage: ${formatSignature(command)} ${flags}`,
      "",
      command.answers,
      "",
      ...command.notes,
      "",
      "Flags:",
      ...command.flags.flatMap(describeFlag),
      "  --help",
      "      Prints this help.",
      "",
      "Example:",
      `  ${command.example}`,
      "",
      "Exit codes:",
      ...describeExits(command.exits),
      "",
    ].join("\n");
  }
  const width = Math.max(...catalogue.map((entry) => entry.name.length));
  return [
    "docket shows how long each GitHub issue, pull request and discussion on the watched repositories has waited, and who owes the next reply, review or close.",
    "",
    "Usage: docket [command] [arguments] [flags]",
    "",
    "Commands:",
    ...catalogue.map(
      (entry) => `  ${entry.name.padEnd(width)}  ${entry.answers}`,
    ),
    "",
    "With no command, docket opens the terminal interface on owed in a terminal, and prints owed when piped.",
    "",
    "Flags:",
    "  --help",
    "      Prints this help; after a command, that command's help.",
    "  --version",
    "      Prints docket's version.",
    "",
    "Run `docket <command> --help` for a command's arguments, flags and their defaults, an example and its exit codes.",
    "",
    "Exit codes:",
    "  0  docket answered, even when threads are over target.",
    "  2  A prerequisite is missing, or the call is not valid.",
    "  3  No data could be obtained, or GitHub refused a change.",
    "",
    "docket needs the GitHub CLI (gh), signed in with `gh auth login`.",
    "",
  ].join("\n");
}
