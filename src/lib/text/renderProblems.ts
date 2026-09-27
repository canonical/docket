import sanitize from "./sanitize.js";
import type { Format, Problem } from "./types.js";

/**
 * Writes problems, each with its named code, one sentence and a
 * `Recovery:` line: the errors that stopped a call, or the warnings that
 * weaken an answer given anyway. A message can repeat text from a file or
 * from GitHub, so every part is made safe to print.
 */
export default function renderProblems(
  problems: readonly Problem[],
  format: Format,
  label: "Error" | "Warning" = "Error",
): string {
  const safe = problems.map(({ code, message, recovery }) => ({
    code,
    message: sanitize(message),
    recovery: sanitize(recovery),
  }));
  if (format === "json") {
    const key = label === "Error" ? "errors" : "warnings";
    return `${JSON.stringify({ [key]: safe }, null, 2)}\n`;
  }
  const heading = format === "llm" ? `## ${label}: ` : `${label} `;
  const blocks = safe.map(
    ({ code, message, recovery }) =>
      `${heading}${code}\n${message}\nRecovery: ${recovery}\n`,
  );
  return blocks.join("\n");
}
