import sanitize from "./sanitize.js";

/**
 * Writes an answer as JSON, for a program. Every string in it passes
 * through `sanitize`, whatever field holds it, so no text from GitHub or
 * a file reaches a terminal as a control character: `JSON.stringify`
 * escapes the C0 controls but leaves the C1 ones (U+0080 to U+009F), such
 * as the one-byte control sequence introducer, as they are. Line feeds
 * and tabs stay, so a comment keeps its lines.
 */
export default function renderJson(data: unknown): string {
  const text = JSON.stringify(
    data,
    (_key, value: unknown) =>
      typeof value === "string" ? sanitize(value, true) : value,
    2,
  );
  return `${text}\n`;
}
