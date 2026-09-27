import { describe, expect, it } from "vitest";
import parseArguments from "./parseArguments.js";

describe("parseArguments", () => {
  it("asks for owed when no command is given, in the format the output calls for", () => {
    expect(parseArguments([], false)).toEqual({
      kind: "command",
      invocation: {
        command: "owed",
        positionals: [],
        format: "llm",
        detail: "standard",
        maxAge: 300_000,
        by: undefined,
        window: undefined,
      },
    });
    const request = parseArguments([], true);
    expect(request.kind === "command" && request.invocation.format).toBe(
      "plain",
    );
  });

  it("reads a command's arguments and flags, the maximum age in seconds", () => {
    const request = parseArguments(
      ["show", "example#12", "--max-age", "0", "--format", "json"],
      true,
    );
    expect(request).toMatchObject({
      kind: "command",
      invocation: {
        command: "show",
        positionals: ["example#12"],
        format: "json",
        maxAge: 0,
      },
    });
  });

  it("asks for help, docket's own or a command's, and for the version", () => {
    expect(parseArguments(["--help"], false)).toEqual({
      kind: "help",
      command: undefined,
    });
    expect(parseArguments(["show", "--help"], false)).toEqual({
      kind: "help",
      command: "show",
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
  ] as const)("refuses %j with %s", (args, code, message) => {
    expect(() => parseArguments(args, false)).toThrow(
      expect.objectContaining({
        code,
        message: expect.stringContaining(message),
      }),
    );
  });
});
