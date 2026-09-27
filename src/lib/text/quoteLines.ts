import sanitize from "./sanitize.js";

/**
 * Marks a long piece of text written on GitHub, such as a comment, as
 * quoted data for an agent: every line of it starts with `> `, so none of
 * it can end the quote and pass for docket's words.
 */
export default function quoteLines(text: string): string {
  return sanitize(text, true)
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`))
    .join("\n");
}
