import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import type { KeyCommand } from "../../hooks/index.js";
import { ScrolledList } from "../../layout/ScrolledList/index.js";
import trimText from "../../trimText.js";
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
 * header that reads `help`. `?` shows and hides it. Its lines scroll as a
 * list's do, drawn through the same scrolled list: a group's heading, with
 * the blank line above it, is a heading, and a key's line, with its notes,
 * a row, the last carrying the closing note. So a pane too short for
 * the help pins the heading of the keys under its first line and counts
 * the key lines under it, `↓ 8 below`, and the movement keys scroll it
 * from `first`.
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
    const heading = { text: group, fit: "trimmed" } as const;
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
        const keys = trimText(writeKeys(line), width - indent);
        const gap = " ".repeat(Math.max(1, keyColumn - Bun.stringWidth(keys)));
        const room = width - indent - Bun.stringWidth(keys) - gap.length;
        // The closing note rides with the last key line, so it is never
        // cut off without that line being counted below.
        const closes = line === last;
        return {
          key: `${group} ${line.label}`,
          kind: "row",
          lines: 1 + line.notes.length + (closes ? 2 : 0),
          node: (
            <>
              <text fg={tokens["color.text"]}>
                {pad}
                {keys}
                {gap}
                {trimText(line.label, room)}
              </text>
              {line.notes.map((each) => (
                <text key={each} fg={tokens["color.text"]}>
                  {notePad}
                  {trimText(each, width - notePad.length)}
                </text>
              ))}
              {closes && (
                <text marginTop={1} fg={tokens["color.text"]}>
                  {pad}
                  {trimText(note, width - indent)}
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
