import type { Context, Invocation, TerminalMode } from "./types.js";

/**
 * The mode the terminal interface opens on for a call, or `undefined` when
 * the call is answered in text. The interface opens only when a terminal
 * gives both the input and the output and no `--format` is given: `docket`
 * alone opens owed, and `docket activity` opens activity. Piped or
 * captured, every call prints text, so an agent always reads text.
 */
export default function chooseTerminalMode(
  context: Pick<Context, "args" | "interactive" | "interactiveInput">,
  invocation: Invocation,
): TerminalMode | undefined {
  if (!context.interactive || !context.interactiveInput) return undefined;
  if (context.args.length === 0) return "owed";
  if (invocation.command === "activity" && !invocation.formatGiven) {
    return "activity";
  }
  return undefined;
}
