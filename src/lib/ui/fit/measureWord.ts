import { asciiText } from "./constants.js";
import measureUnkept from "./measureUnkept.js";

/**
 * The most words of wrapped text whose cells are kept: enough for the
 * messages a screen wraps, so a redraw measures none of them twice; once
 * it is reached, every kept word is forgotten, which costs less than
 * forgetting them one by one.
 */
const wordsKept = 4096;

/** The cells of each word kept, apart from `measureText`'s texts. */
const measuredWords = new Map<string, number>();

/**
 * The display cells one word of wrapped text takes, as `measureText`
 * counts them, kept in a cache of its own, so a long message's words
 * never crowd out the titles and names every draw measures.
 *
 * @note Impure: it keeps the cells of up to `wordsKept` words, and
 * measures through `measureUnkept`, which calls OpenTUI's native library.
 */
export default function measureWord(word: string): number {
  if (asciiText.test(word)) return word.length;
  const known = measuredWords.get(word);
  if (known !== undefined) return known;
  const cells = measureUnkept(word);
  if (measuredWords.size >= wordsKept) measuredWords.clear();
  measuredWords.set(word, cells);
  return cells;
}
