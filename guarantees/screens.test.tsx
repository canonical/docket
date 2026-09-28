/**
 * The terminal's screens, as a person sees them: every story of every
 * terminal component, drawn through OpenTUI's test renderer at 40 columns
 * and at 60, and compared with its saved copy, the characters of each
 * line and then the colours and weight of each run of text on it. A
 * story names a state worth pinning, so a component's stories file is
 * the list of its screens: a new story is drawn and compared from the
 * first run, and until its copy is saved it fails.
 *
 * Below 40 columns the pane says only that it needs 40.
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
const storyFiles = /^src\/lib\/ui\/.+\.stories\.tsx$/;

/** The widths every story is drawn at: the least the pane allows, and one wider. */
const widths = [40, 60];
/** Room enough for the tallest story; blank lines below the last are left out. */
const height = 24;
/** The screen drawn too narrow, and how narrow. */
const narrow = { title: "layout/Pane", story: "NothingOwed", width: 32 };

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

const paths = [
  ...new Bun.Glob("src/lib/ui/**/*.stories.tsx").scanSync(repoRoot),
]
  .map((path) => path.replaceAll("\\", "/"))
  .sort();

const loadStoryFile = async (path: string): Promise<StoryFile> => {
  if (!storyFiles.test(path)) {
    throw new Error(`${path} is not a component's stories file`);
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

const hex = (colour: CapturedSpan["fg"]) =>
  `#${colour
    .toInts()
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;

const attributeNames = Object.entries(TextAttributes).filter(
  ([name]) => name !== "NONE",
);
const describeAttributes = (attributes: number) =>
  attributeNames
    .filter(([, bit]) => (attributes & bit) !== 0)
    .map(([name]) => ` ${name.toLowerCase()}`)
    .join("");

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
  const lines = setup
    .captureCharFrame()
    .split("\n")
    .slice(0, height)
    .map((line) => line.trimEnd());
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
          hex(span.bg) === hex(background);
        return blank
          ? []
          : [
              `${row + 1}:${at + 1} ${JSON.stringify(span.text)} fg ${hex(span.fg)} bg ${hex(span.bg)}${describeAttributes(span.attributes)}`,
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

const storiesOf = (file: StoryFile) =>
  Object.entries(file).filter(
    (entry): entry is [string, Story] => entry[0] !== "default",
  );

describe("screens", () => {
  it("finds the stories of the terminal's components", () => {
    expect(paths.length).toBeGreaterThan(0);
  });

  for (const [index, file] of files.entries()) {
    const { title } = file.default;
    describe(`${title} (${paths[index]})`, () => {
      for (const [name, story] of storiesOf(file)) {
        for (const width of widths) {
          it(`draws ${name} at ${width} columns as its saved copy shows`, async () => {
            const screen = await drawStory(file, story, width);
            expectGolden(`screens/${title}/${name}.${width}.txt`, screen);
          });
        }
      }
    });
  }

  it(`says only that the pane needs 40 columns when drawn at ${narrow.width}`, async () => {
    const file = files.find(({ default: meta }) => meta.title === narrow.title);
    const story = storiesOf(file ?? ({} as StoryFile)).find(
      ([name]) => name === narrow.story,
    );
    if (!file || !story) {
      throw new Error(`no story ${narrow.story} in ${narrow.title}`);
    }
    const screen = await drawStory(file, story[1], narrow.width);
    expect(screen.split("\n").filter((line) => line.startsWith("|"))).toEqual([
      "|docket needs 40 columns",
    ]);
    expectGolden(
      `screens/${narrow.title}/${narrow.story}.${narrow.width}.txt`,
      screen,
    );
  });
});
