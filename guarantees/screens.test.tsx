/**
 * The terminal's screens, as a person sees them: every story under
 * `src/`, drawn through OpenTUI's test renderer at 40 columns and at 60,
 * and compared with its saved copy, the characters of each line and then
 * the colours and weight of each run of text on it. A story names a state
 * worth pinning, so a stories file is the list of its screens: a new
 * story is drawn and compared from the first run, and until its copy is
 * saved it fails.
 *
 * Below 40 columns the pane says only that it needs 40. Each block of
 * the terminal has a story named `Long`, with text longer than it holds.
 *
 * The stories are found by their file names, so this file loads each
 * one by a path it builds, and checks every such path against the one
 * pattern the structure check allows the corpus to import.
 */
import { resolve } from "node:path";
import { type CapturedSpan, TextAttributes } from "@opentui/core";
import { testRender } from "@opentui/react/test-utils";
import {
  act,
  cloneElement,
  isValidElement,
  type ReactNode,
  useState,
} from "react";
import { afterEach, describe, expect, it } from "vitest";
import expectGolden from "./expectGolden.js";

const repoRoot = resolve(import.meta.dirname, "..");
const storyFiles = /^src\/.+\.stories\.tsx$/;
/**
 * The terminal's blocks, each of which draws text longer than its slot
 * gives it in a story named `Long`, so how each gives way is pinned.
 */
const blockFiles = /^src\/lib\/ui\/.+\.stories\.tsx$/;

/** The widths every story is drawn at: the least the pane allows, and one wider. */
const widths = [40, 60];
/**
 * The approved frames' height. The composed screen and the pane fill it,
 * so every group of a frame is drawn whole; a shorter story ends at its
 * last line, the blank lines below it left out.
 */
const height = 36;
/** How narrow the screens drawn too narrow are. */
const narrowWidth = 32;
/** The screens drawn too narrow: the pane alone, and the composed screen. */
const narrow = [
  { title: "layout/Pane", story: "NothingOwed" },
  { title: "application/Screen", story: "Owed" },
];

interface Story {
  readonly args: Readonly<Record<string, unknown>>;
}
interface StoryFile {
  readonly default: {
    readonly title: string;
    readonly component: (props: Record<string, unknown>) => ReactNode;
  };
  readonly [name: string]: unknown;
}

const paths = [...new Bun.Glob("src/**/*.stories.tsx").scanSync(repoRoot)]
  .map((path) => path.replaceAll("\\", "/"))
  .sort();

const loadStoryFile = async (path: string): Promise<StoryFile> => {
  if (!storyFiles.test(path)) {
    throw new Error(`${path} is not a stories file`);
  }
  return import(`${repoRoot}/${path}`);
};

const files = await Promise.all(paths.map(loadStoryFile));

/**
 * `value` with every `width` that equals `from` set to `to`, however deep,
 * inside the elements a story composes too: each block takes its width as
 * a prop, and a story drawn wider gives every block in it the wider width.
 */
function widen(value: unknown, from: number, to: number): unknown {
  if (isValidElement(value)) {
    return cloneElement(
      value,
      widen(value.props, from, to) as Record<string, unknown>,
    );
  }
  if (Array.isArray(value)) return value.map((each) => widen(each, from, to));
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => [
        key,
        key === "width" && each === from ? to : widen(each, from, to),
      ]),
    );
  }
  return value;
}

const drawn: { destroy: () => void }[] = [];
// Destroying a screen unmounts its story, an update React expects inside
// `act`.
afterEach(() => {
  act(() => {
    for (const renderer of drawn.splice(0)) renderer.destroy();
  });
});

const formatHex = (colour: CapturedSpan["fg"]) =>
  `#${colour
    .toInts()
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;

/**
 * A run's colours. `GUARANTEES_BREAK=uncoloured`, which
 * `bun run guarantees:prove` alone sets, leaves them out, as a copy blind
 * to colour would, so the entry is seen to fail when colours go unread.
 */
const describeColours = (span: CapturedSpan) =>
  process.env.GUARANTEES_BREAK === "uncoloured"
    ? ""
    : ` fg ${formatHex(span.fg)} bg ${formatHex(span.bg)}`;

const attributeNames = Object.entries(TextAttributes).filter(
  ([name]) => name !== "NONE",
);
const describeAttributes = (attributes: number) =>
  attributeNames
    .filter(([, bit]) => (attributes & bit) !== 0)
    .map(([name]) => ` ${name.toLowerCase()}`)
    .join("");

/**
 * A screen's lines. `GUARANTEES_BREAK=reordered`, which
 * `bun run guarantees:prove` alone sets, moves the fourth line up to
 * second: on owed's first frame, the accordion's first line drawn above
 * its selected row, as a list that composed the two the other way round
 * would draw it. The entry is then seen to fail when a frame's
 * composition changes, and not only a block.
 */
function reorderLines(lines: readonly string[]): readonly string[] {
  if (process.env.GUARANTEES_BREAK !== "reordered") return lines;
  const moved = [...lines];
  moved.splice(1, 0, ...moved.splice(3, 1));
  return moved;
}

/**
 * Draws `node` on a screen `width` columns wide and writes it out: the
 * characters of each line, then each run of text by line and column with
 * its colours and weight, one to a line, so a difference points at the
 * line or the run that changed. A run of spaces on no background of its
 * own is left out; its place is in the lines above.
 *
 * The node mounts inside an awaited `act`, which lets a story that waits
 * on a promise, such as a thread's details, draw what the promise gives.
 */
async function drawScreen(node: ReactNode, width: number): Promise<string> {
  let mount = () => {};
  const Later = () => {
    const [shown, setShown] = useState(false);
    mount = () => setShown(true);
    return shown ? node : null;
  };
  const setup = await testRender(<Later />, { width, height });
  drawn.push(setup.renderer);
  await act(async () => {
    mount();
    await setup.flush();
  });
  await setup.renderOnce();
  const lines = reorderLines(
    setup
      .captureCharFrame()
      .split("\n")
      .slice(0, height)
      .map((line) => line.trimEnd()),
  );
  const shown = lines.findLastIndex((line) => line !== "") + 1;
  const background = setup.captureSpans().lines.at(-1)?.spans.at(0)?.bg;
  const runs = setup
    .captureSpans()
    .lines.slice(0, shown)
    .flatMap(({ spans }, row) => {
      let column = 0;
      return spans.flatMap((span) => {
        const at = column;
        column += span.width;
        const blank =
          span.text.trim() === "" &&
          background !== undefined &&
          formatHex(span.bg) === formatHex(background);
        return blank
          ? []
          : [
              `${row + 1}:${at + 1} ${JSON.stringify(span.text)}${describeColours(span)}${describeAttributes(span.attributes)}`,
            ];
      });
    });
  return [
    `${width} columns`,
    ...lines.slice(0, shown).map((line) => `|${line}`),
    "",
    "runs",
    ...runs,
    "",
  ].join("\n");
}

/** Draws `story` from `file` at `width`, every block in it as wide. */
function drawStory(file: StoryFile, story: Story, width: number) {
  const { component: Component } = file.default;
  const own = story.args.width;
  const args = (
    typeof own === "number" ? widen(story.args, own, width) : story.args
  ) as Record<string, unknown>;
  return drawScreen(<Component {...args} />, width);
}

const listStories = (file: StoryFile) =>
  Object.entries(file).filter(
    (entry): entry is [string, Story] => entry[0] !== "default",
  );

describe("screens", () => {
  it("finds the stories under src/", () => {
    expect(paths.length).toBeGreaterThan(0);
  });

  for (const [index, file] of files.entries()) {
    const { title } = file.default;
    describe(`${title} (${paths.at(index)})`, () => {
      if (blockFiles.test(paths.at(index) ?? "")) {
        it("draws the block with text longer than it holds, in a Long story", () => {
          expect(listStories(file).map(([name]) => name)).toContain("Long");
        });
      }
      for (const [name, story] of listStories(file)) {
        for (const width of widths) {
          it(`draws ${name} at ${width} columns as its saved copy shows`, async () => {
            const screen = await drawStory(file, story, width);
            expectGolden(`screens/${title}/${name}.${width}.txt`, screen);
          });
        }
      }
    });
  }

  for (const { title, story: named } of narrow) {
    it(`says only that ${title}'s ${named} needs 40 columns when drawn at ${narrowWidth}`, async () => {
      const file = files.find(({ default: meta }) => meta.title === title);
      const story = listStories(file ?? ({} as StoryFile)).find(
        ([name]) => name === named,
      );
      if (!file || !story) {
        throw new Error(`no story ${named} in ${title}`);
      }
      const screen = await drawStory(file, story[1], narrowWidth);
      expect(screen.split("\n").filter((line) => line.startsWith("|"))).toEqual(
        ["|docket needs 40 columns"],
      );
      expectGolden(`screens/${title}/${named}.${narrowWidth}.txt`, screen);
    });
  }
});
