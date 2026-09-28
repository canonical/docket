import { describe, expect, it } from "vitest";
import { catalogue, renderHelp } from "../lib/text/index.js";
import parseArguments from "./parseArguments.js";

describe("parseArguments", () => {
  it("asks for owed when no command is given, in the format the output calls for, with the catalogue's defaults", () => {
    expect(parseArguments([], false)).toEqual({
      kind: "command",
      invocation: {
        command: "owed",
        positionals: [],
        format: "llm",
        formatGiven: false,
        detail: "standard",
        maxAge: 300_000,
        by: "none",
        window: undefined,
        confirm: false,
      },
    });
    const request = parseArguments([], true);
    expect(request.kind === "command" && request.invocation.format).toBe(
      "plain",
    );
  });

  it("reads a command's arguments and flags, the maximum age in seconds", () => {
    const request = parseArguments(
      [
        "assign",
        "example#12",
        "alice",
        "--confirm",
        "--max-age",
        "0",
        "--format",
        "json",
      ],
      true,
    );
    expect(request).toMatchObject({
      kind: "command",
      invocation: {
        command: "assign",
        positionals: ["example#12", "alice"],
        format: "json",
        formatGiven: true,
        maxAge: 0,
        confirm: true,
      },
    });
  });

  it("parses, and documents, every flag the catalogue lists", () => {
    for (const command of catalogue) {
      const help = renderHelp(command.name);
      for (const flag of command.flags) {
        // A value each flag takes: its last choice, or a whole number; a
        // switch takes none.
        const switched = flag.value === undefined;
        const value = switched ? [] : [flag.choices?.at(-1) ?? "1"];
        const args = [command.name, `--${flag.name}`, ...value];
        expect(parseArguments(args, false).kind).toBe("command");
        expect(help).toContain(`  --${flag.name}${switched ? "\n" : " "}`);
      }
    }
  });

  it("asks for help, docket's own or a command's, and for the version", () => {
    expect(parseArguments(["--help"], false)).toEqual({
      kind: "help",
      command: undefined,
    });
    expect(parseArguments(["review", "--help"], false)).toEqual({
      kind: "help",
      command: "review",
    });
    expect(parseArguments(["--version"], false)).toEqual({ kind: "version" });
  });

  it.each([
    [["--wat"], "USAGE_UNKNOWN_FLAG", "docket has no flag `--wat`."],
    [
      ["owed", "--format"],
      "USAGE_INVALID_VALUE",
      "The flag `--format` is given without the value it needs",
    ],
    [
      ["owed", "--confirm=yes"],
      "USAGE_INVALID_VALUE",
      "The flag `--confirm` is given",
    ],
    [
      ["config", "--by", "owner"],
      "USAGE_UNKNOWN_FLAG",
      "docket config takes no flag `--by`.",
    ],
    [
      ["owed", "--by", "kind"],
      "USAGE_INVALID_VALUE",
      "`--by` takes none, owner, repo, stack, not `kind`.",
    ],
    [
      ["owed", "--max-age", "5m"],
      "USAGE_INVALID_VALUE",
      "`--max-age` takes a whole number of seconds, not `5m`.",
    ],
    [["docs"], "USAGE_UNKNOWN_COMMAND", "docket has no command `docs`."],
    [
      ["config", "--", "--by"],
      "USAGE_UNEXPECTED_ARGUMENT",
      "docket config takes no arguments, and was given `--by`.",
    ],
  ] as const)("refuses %j with %s", (args, code, message) => {
    expect(() => parseArguments(args, false)).toThrow(
      expect.objectContaining({
        code,
        message: expect.stringContaining(message),
      }),
    );
  });
});
