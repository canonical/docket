/**
 * Escape sequences, whole: a control sequence (`ESC [` or its one-byte
 * form), a string such as an operating-system command (`ESC ]`, which can
 * set the clipboard) up to its terminator or the end of the text, or a
 * two-byte escape. Removing only the escape byte would leave the rest of
 * the sequence on screen as noise.
 */
const sequences =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters removed.
  /\u001b\[[0-?]*[ -/]*[@-~]|\u009b[0-?]*[ -/]*[@-~]|(?:\u001b[\]PX^_]|[\u0090\u0098\u009d\u009e\u009f])[\s\S]*?(?:\u0007|\u001b\\|\u009c|$)|\u001b[ -~]?/g;

/** Every other control character but the tab and the line feed. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters removed.
const controls = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/** Breaks between lines, including Unicode's own separators. */
const breaks = /[\t\n\u2028\u2029]+/g;

/**
 * Makes text written on GitHub, or in a repository's configuration file,
 * safe to print: a title or comment could otherwise carry sequences that
 * move the cursor, redraw the screen or set the clipboard. Escape
 * sequences and control characters are removed.
 *
 * @param keepLines Keeps line feeds and tabs, for a comment printed as a
 * block. Without it, each run of them becomes one space, so a field such
 * as a title stays on its line.
 */
export default function sanitize(text: string, keepLines = false): string {
  const cleaned = text.replace(sequences, "").replace(controls, "");
  return keepLines ? cleaned : cleaned.replace(breaks, " ");
}
