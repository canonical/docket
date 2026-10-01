import { sanitize } from "../../text/index.js";
import { graphemes, noBreakSpace } from "./constants.js";
import measureCluster from "./measureCluster.js";
import measureWord from "./measureWord.js";
import type { Run } from "./types.js";

/** Part of a word: its text, in the look of the run it came from. */
interface Fragment<Look> {
  readonly look: Look;
  readonly text: string;
}

/**
 * The cells of a word's fragments, measured with `measureWord`, so a long
 * message's words never crowd out the texts every draw measures.
 */
const measureFragments = <Look>(fragments: readonly Fragment<Look>[]) =>
  fragments.reduce((sum, { text }) => sum + measureWord(text), 0);

/** A word, and the look of the space before it. */
interface Word<Look> {
  readonly space: Look;
  readonly fragments: Fragment<Look>[];
}

/** A word that fits a line, and the cells it takes, measured once. */
interface Sized<Look> extends Word<Look> {
  cells: number;
}

/**
 * The words of `runs`, split at each space, none after a space that ends
 * them. A marked person is one word with its mark, and a no-break space
 * joins two words into one.
 */
function splitWords<Look extends Run>(
  runs: readonly Look[],
  first: Look,
): Word<Look>[] {
  const words: Word<Look>[] = [];
  let word: Word<Look> = { space: first, fragments: [] };
  for (const look of runs) {
    const clean = sanitize(look.text);
    (look.marked ? [clean] : clean.split(" ")).forEach((part, place) => {
      if (place > 0) {
        words.push(word);
        word = { space: look, fragments: [] };
      }
      if (part !== "") word.fragments.push({ look, text: part });
    });
  }
  // A space that ends the runs opens no word of its own.
  return word.fragments.length > 0 || words.length === 0
    ? [...words, word]
    : words;
}

/**
 * Splits a word wider than a line into pieces that fit, losing no
 * character, each with the cells it takes.
 */
function splitWide<Look extends Run>(
  word: Word<Look>,
  width: number,
): Sized<Look>[] {
  const whole = measureFragments(word.fragments);
  if (whole <= width) return [{ ...word, cells: whole }];
  let piece: Sized<Look> = { space: word.space, fragments: [], cells: 0 };
  const pieces = [piece];
  let used = 0;
  for (const { look, text } of word.fragments) {
    for (const { segment } of graphemes.segment(text)) {
      const cells = measureCluster(segment);
      if (used > 0 && used + cells > width) {
        piece = { space: look, fragments: [], cells: 0 };
        pieces.push(piece);
        used = 0;
      }
      const last = piece.fragments.at(-1);
      if (last?.look === look) {
        piece.fragments.splice(-1, 1, { look, text: last.text + segment });
      } else {
        piece.fragments.push({ look, text: segment });
      }
      used += cells;
      piece.cells += cells;
    }
  }
  return pieces;
}

/**
 * Wraps the runs of one line, each drawn in its own look, into lines of
 * at most `width` display cells, breaking only at spaces. Each run keeps
 * its look on every line it reaches; a marked person never breaks from
 * their mark, and words joined by a no-break space stay on one line and
 * are shown with an ordinary space. A word wider than a line is split, so
 * nothing is lost. Each run passes through `sanitize` first.
 */
export default function wrapRuns<Look extends Run>(
  runs: readonly Look[],
  width: number,
): Look[][] {
  const [head] = runs;
  if (head === undefined) return [[]];
  // splitWords gives one word at least, and splitWide one piece of each.
  const [first, ...rest] = splitWords(runs, head).flatMap((each) =>
    splitWide(each, width),
  );
  const lines: Fragment<Look>[][] = [];
  let line = [...first.fragments];
  let used = first.cells;
  for (const { cells, ...word } of rest) {
    if (used + 1 + cells <= width) {
      line.push({ look: word.space, text: " " }, ...word.fragments);
      used += 1;
    } else {
      lines.push(line);
      line = [...word.fragments];
      used = 0;
    }
    used += cells;
  }
  return [...lines, line].map((each) =>
    each.map(({ look, text }) => ({
      ...look,
      text: text.replaceAll(noBreakSpace, " "),
    })),
  );
}
