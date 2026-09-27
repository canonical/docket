// A message is one line, so a long list or map shows its first entries only.
const shownEntries = 5;

function formatEntries(entries: readonly string[]): string {
  const shown = entries.slice(0, shownEntries);
  return entries.length > shownEntries
    ? [...shown, "…"].join(", ")
    : shown.join(", ");
}

function formatNested(value: unknown, nested: boolean): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return nested
      ? "[…]"
      : `[${formatEntries(value.map((item) => formatNested(item, true)))}]`;
  }
  if (value instanceof Map) {
    if (nested) return "{…}";
    if (value.size === 0) return "{}";
    const entries = [...value].map(
      ([key, item]) =>
        `${formatNested(key, true)}: ${formatNested(item, true)}`,
    );
    return `{ ${formatEntries(entries)} }`;
  }
  return `${value}`;
}

/**
 * Writes a value read from a file as a message shows it: text in double
 * quotes, a list in brackets and a map in braces. A list or map inside
 * another shows as `[…]` or `{…}`, so the message stays short.
 */
export default function formatValue(value: unknown): string {
  return formatNested(value, false);
}
