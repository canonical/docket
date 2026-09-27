import { describe, expect, it } from "vitest";
import catalogue from "./catalogue.js";
import renderHelp from "./renderHelp.js";

describe("renderHelp", () => {
  it("lists every command with the question it answers, and the exit codes", () => {
    const help = renderHelp();
    expect(help).toContain("Usage: docket [command] [arguments] [flags]");
    for (const { name, answers } of catalogue) {
      expect(help).toMatch(
        new RegExp(`^  ${name} +${answers.slice(0, 20)}`, "m"),
      );
    }
    expect(help).toContain("  --version\n      Prints docket's version.");
    expect(help).toMatch(/^ {2}0 {2}docket answered/m);
    expect(help).toMatch(/^ {2}2 {2}A prerequisite is missing/m);
    expect(help).toMatch(/^ {2}3 {2}No data could be obtained/m);
  });

  it("gives a command's arguments, flags with their defaults, one example and exit codes", () => {
    expect(
      renderHelp("show"),
    ).toBe(`Usage: docket show <reference> [--format plain|llm|json] [--detail summary|standard|detailed] [--max-age <seconds>]

Everything about one thread, untrimmed: its waits, its latest message, the reviews requested, its checks, its files and its stack.

A reference names a thread as \`<repo>#<number>\`, such as \`example#12\`, where \`<repo>\` is the short name in the configuration's \`repos\`. \`<repo> stack <number>\` shows every open pull request of a stack.
The thread must be open: docket keeps only open threads.

Flags:
  --format plain|llm|json
      How the answer is written: plain text for a person, condensed Markdown for an agent (llm), or JSON for a program. In JSON, every key, and every value docket names, such as a kind or a state, is a fixed camelCase identifier rather than an on-screen word: the configuration's \`next-move\` is \`nextMove\`. Default: plain in a terminal, llm when the output is piped or captured.
  --detail summary|standard|detailed
      How much each item shows: summary gives the counts alone, detailed adds when each wait started, its target, and every message, file and check. Default: standard.
  --max-age <seconds>
      How old the cached data may be before docket fetches from GitHub; 0 always fetches. Default: 300.
  --help
      Prints this help.

Example:
  docket show example#12

Exit codes:
  0  docket answered, even when threads are over target, and also when it served cached data during a rate limit or an outage, with a warning.
  2  A prerequisite is missing: gh is not installed or not signed in, the personal configuration is invalid, or the call itself is not valid.
  3  No data could be obtained from GitHub or the cache.
`);
  });

  it.each(catalogue.map((command) => [command.name, command] as const))(
    "gives every flag, the example and the three exit codes for %s",
    (name, command) => {
      const help = renderHelp(name);
      for (const flag of command.flags) {
        expect(help).toContain(`\n  --${flag.name}`);
        expect(help).toContain(`Default: ${flag.fallback ?? flag.default}.`);
      }
      expect(help).toContain(`Example:\n  ${command.example}\n`);
      expect(help).toMatch(/Exit codes:\n {2}0 .+\n {2}2 .+\n {2}3 .+\n$/);
    },
  );
});
