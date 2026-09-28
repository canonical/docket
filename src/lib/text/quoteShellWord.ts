/**
 * Writes one word of a command so a POSIX shell reads it back as that one
 * word: a word of letters, digits and `_@%+=:,./#-` alone, not starting
 * with `#`, `=` or `~`, stays as it is; any other goes in single quotes,
 * each single quote in it written as `'\''`. A name with a space or a
 * shell character in it can then neither split into two words nor run.
 */
export default function quoteShellWord(word: string): string {
  return /^[\w@%+:,./-][\w@%+=:,./#-]*$/.test(word)
    ? word
    : `'${word.replaceAll("'", `'\\''`)}'`;
}
