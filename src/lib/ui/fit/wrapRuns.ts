import { sanitize } from "../../text/index.js";
import measureText from "./measureText.js";

/** A space that joins two words so no line breaks between them. */
const joiner = " ";

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Part of a word: its text, and which run it came from. */
interface Fragment {
  readonly run: number;
  readonly text: string;
}

/** A word, and the run the space before it came from. */
interface Word {
  readonly space: number;
  readonly fragments: readonly Fragment[];
}

const measure = (fragments: readonly Fragment[]) =>
  fragments.reduce((cells, { text }) => cells + measureText(text), 0);

/**
 * The words of `runs`, split at each space, none after a space that ends
 * them. A marked person is one word
 * with its mark, and a no-break space joins two words into one.
 */
function splitWords(
  runs: readonly { readonly text: string; readonly marked?: boolean }[],
): Word[] {
  const words: Word[] = [];
  let word: Word = { space: 0, fragments: [] };
  runs.forEach(({ text, marked }, run) => {
    const clean = sanitize(text);
    (marked ? [clean] : clean.split(" ")).forEach((part, place) => {
      if (place > 0) {
        words.push(word);
        word = { space: run, fragments: [] };
      }
      if (part !== "")
        word = { ...word, fragments: [...word.fragments, { run, text: part }] };
    });
  });
  // A space that ends the runs opens no word of its own.
  return word.fragments.length > 0 || words.length === 0
    ? [...words, word]
    : words;
}

/** Splits a word wider than a line into pieces that fit, losing no character. */
function splitWide(word: Word, width: number): Word[] {
  if (measure(word.fragments) <= width) return [word];
  const pieces: Fragment[][] = [[]];
  let used = 0;
  for (const { run, text } of word.fragments) {
    for (const { segment } of graphemes.segment(text)) {
      const cells = measureText(segment);
      if (used > 0 && used + cells > width) {
        pieces.push([]);
        used = 0;
      }
      const piece = pieces[pieces.length - 1];
      const last = piece.pop();
      piece.push(
        ...(last?.run === run
          ? [{ run, text: last.text + segment }]
          : [...(last ? [last] : []), { run, text: segment }]),
      );
      used += cells;
    }
  }
  return pieces.map((fragments, place) => ({
    space: place === 0 ? word.space : fragments[0].run,
    fragments,
  }));
}

/**
 * Wraps the runs of one line, each drawn in its own look, into lines of
 * at most `width` display cells, breaking only at spaces. Each run keeps
 * its look on every line it reaches; a marked person never breaks from
 * their mark, and words joined by a no-break space stay on one line and
 * are shown with an ordinary space. A word wider than a line is split, so
 * nothing is lost. Each run passes through `sanitize` first.
 */
export default function wrapRuns<
  Run extends { readonly text: string; readonly marked?: boolean },
>(runs: readonly Run[], width: number): Run[][] {
  // splitWords gives one word at least, and splitWide one piece of each.
  const [first, ...rest] = splitWords(runs).flatMap((each) =>
    splitWide(each, width),
  );
  const lines: Fragment[][] = [];
  let line = [...first.fragments];
  let used = measure(line);
  for (const word of rest) {
    const cells = measure(word.fragments);
    if (used + 1 + cells <= width) {
      line.push({ run: word.space, text: " " }, ...word.fragments);
      used += 1;
    } else {
      lines.push(line);
      line = [...word.fragments];
      used = 0;
    }
    used += cells;
  }
  return [...lines, line].map((each) =>
    each.map(({ run, text }) => ({
      ...runs[run],
      text: text.replaceAll(joiner, " "),
    })),
  );
}
