import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField, measureText } from "../../fit/index.js";
import type { KeyCommand } from "../../hooks/index.js";
import { ScrolledList } from "../../layout/ScrolledList/index.js";
import type { ListBlock } from "../../types.js";
import { GroupHeading } from "../GroupHeading/index.js";
import type { HelpOverlayProps } from "./types.js";

/** The indent of a key, in display cells. */
const indent = 2;

/** The cells a key takes before its label, which all start in one column. */
const keyColumn = 9;

/** Groups the commands by what they act on, in the order groups appear. */
function groupCommands(commands: readonly KeyCommand[]) {
  const groups = new Map<string, KeyCommand[]>();
  for (const command of commands) {
    groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  }
  return [...groups];
}

/** Writes a line's keys: the first keys, then the others, `← →  h l`. */
const writeKeys = ({ keys, alternates }: KeyCommand) =>
  [keys.join(" "), alternates.join(" ")].filter(Boolean).join("  ");

/**
 * Every key, grouped by the object it acts on, filling the pane under a
 * header that reads `help`. `?` shows and hides it. A label too long for
 * its column wraps in it, under its first line, and so does each note.
 * Its lines scroll as a list's do, drawn through the same scrolled list:
 * a group's heading, with the blank line above it, is a heading, and a
 * key's line, with its wrapped lines and notes, a row, the last carrying
 * the closing note. So a pane too short for the help pins the heading of
 * the keys under its first line and counts the key lines under it,
 * `↓ 8 below`, and the movement keys scroll it from `first`.
 *
 * `import { HelpOverlay } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.help_overlay
 */
const HelpOverlay = ({
  commands,
  note,
  width,
  height,
  first = 0,
  onShown = () => {},
}: HelpOverlayProps): ReactNode => {
  const pad = " ".repeat(indent);
  const notePad = " ".repeat(indent + keyColumn);
  const groups = groupCommands(commands);
  const last = groups.at(-1)?.[1].at(-1);
  const blocks: ListBlock[] = groups.flatMap(([group, lines]): ListBlock[] => {
    const heading = { text: group, kind: "words" } as const;
    return [
      {
        key: group,
        kind: "heading",
        lines: 2,
        heading,
        node: (
          <box marginTop={1}>
            <GroupHeading heading={heading} width={width} />
          </box>
        ),
      },
      ...lines.map((line): ListBlock => {
        const keys = fitField(
          { text: writeKeys(line), kind: "words" },
          "line",
          width - indent,
        );
        const gap = " ".repeat(Math.max(1, keyColumn - measureText(keys)));
        const column = indent + measureText(keys) + gap.length;
        // The label wraps in its own column, and each note under it.
        const [label, ...rest] = fitField(
          { text: line.label, kind: "words" },
          "block",
          width - column,
        );
        const under = [
          ...rest.map((text) => `${" ".repeat(column)}${text}`),
          ...line.notes.flatMap((each) =>
            fitField(
              { text: each, kind: "words" },
              "block",
              width - notePad.length,
            ).map((text) => `${notePad}${text}`),
          ),
        ];
        // The closing note rides with the last key line, so it is never
        // cut off without that line being counted below.
        const closing =
          line === last && note
            ? fitField(note, "block", width - indent).map(
                (text) => `${pad}${text}`,
              )
            : [];
        return {
          key: `${group} ${line.label}`,
          kind: "row",
          lines:
            1 + under.length + (closing.length > 0 ? 1 + closing.length : 0),
          node: (
            <>
              <text fg={tokens["color.text"]}>
                {pad}
                {keys}
                {gap}
                {label}
              </text>
              {under.map((text, place) => (
                // A label's lines never reorder, so their place is their key.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                <text key={place} fg={tokens["color.text"]}>
                  {text}
                </text>
              ))}
              {closing.length > 0 && (
                <text marginTop={1} fg={tokens["color.text"]}>
                  {closing.join("\n")}
                </text>
              )}
            </>
          ),
        };
      }),
    ];
  });
  return (
    <ScrolledList
      // Drawn anew at each step, so the step's block is the first shown,
      // or the list's end is on the last line.
      key={first}
      blocks={blocks}
      from={first}
      to={first}
      height={height}
      first={first}
      onShown={onShown}
      width={width}
    />
  );
};

export default HelpOverlay;
