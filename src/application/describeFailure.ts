import type { Problem } from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";

/**
 * The problem a failure puts to the user: a named failure as it is, and
 * any other, such as a defect, as `UNEXPECTED_FAILURE`, naming its cause,
 * so that every stop prints a code and a recovery step. The message ends
 * as a sentence: a full stop follows a cause that ends in none of `.`,
 * `?` or `!`, and a cause with no text leaves the message's own sentence
 * alone.
 */
export default function describeFailure(error: unknown): Problem {
  if (isNamedError(error)) {
    const { code, message, recovery } = error;
    return { code, message, recovery };
  }
  const cause = error instanceof Error ? error.message : String(error);
  const lead = "docket stopped on a failure it has no name for";
  return {
    code: "UNEXPECTED_FAILURE",
    message:
      cause === ""
        ? `${lead}.`
        : `${lead}: ${/[.?!]$/.test(cause) ? cause : `${cause}.`}`,
    recovery: "run the command again; if it keeps failing, report it",
  };
}
