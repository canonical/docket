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

/**
 * Unicode's format characters, which draw nothing yet change how text
 * around them reads: the bidirectional overrides and isolates (U+202A to
 * U+202E, U+2066 to U+2069) and marks (U+200E, U+200F, U+061C), which can
 * show a text in another order than it is written, the zero-width joiner
 * and spaces, the soft hyphen and the tag characters. A terminal gives
 * each a cell or none as it likes, so a line measured without them
 * could run past its width.
 */
const formats = /\p{Cf}/gu;

/** Breaks between lines, including Unicode's own separators. */
const breaks = /[\t\n\u2028\u2029]+/g;

/**
 * Makes text written on GitHub, or in a repository's configuration file,
 * safe to print: a title or comment could otherwise carry sequences that
 * move the cursor, redraw the screen or set the clipboard, or show its
 * words in another order than they are written. Escape sequences,
 * control characters and format characters are removed.
 *
 * @param keepLines Keeps line feeds and tabs, for a comment printed as a
 * block. Without it, each run of them becomes one space, so a field such
 * as a title stays on its line.
 */
export default function sanitize(text: string, keepLines = false): string {
  const cleaned = text
    .replace(sequences, "")
    .replace(controls, "")
    .replace(formats, "");
  return keepLines ? cleaned : cleaned.replace(breaks, " ");
}
