import sanitize from "./sanitize.js";

/**
 * Marks a short piece of text written on GitHub, such as a title, as
 * quoted data for an agent: it stands in double quotes, with any quote or
 * backslash inside escaped, so it can never close its own quotes and pass
 * for docket's words.
 */
export default function quote(text: string): string {
  return JSON.stringify(sanitize(text));
}
