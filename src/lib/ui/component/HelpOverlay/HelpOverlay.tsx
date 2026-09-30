import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField } from "../../fit/index.js";
import type { KeyCommand } from "../../hooks/index.js";
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
 *
 * `import { HelpOverlay } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.help_overlay
 */
const HelpOverlay = ({
  commands,
  note,
  width,
}: HelpOverlayProps): ReactNode => {
  const pad = " ".repeat(indent);
  const notePad = " ".repeat(indent + keyColumn);
  return (
    <box flexDirection="column">
      {groupCommands(commands).map(([group, lines]) => (
        <box key={group} flexDirection="column" flexShrink={0} marginTop={1}>
          <GroupHeading
            heading={{ text: group, kind: "words" }}
            width={width}
          />
          {lines.map((line) => {
            const keys = fitField(
              { text: writeKeys(line), kind: "words" },
              "line",
              width - indent,
            );
            const gap = " ".repeat(
              Math.max(1, keyColumn - Bun.stringWidth(keys)),
            );
            const column = indent + Bun.stringWidth(keys) + gap.length;
            // The label wraps in its own column, and each note under it.
            const [first, ...rest] = fitField(
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
            return (
              <box key={line.label} flexDirection="column" flexShrink={0}>
                <text fg={tokens["color.text"]}>
                  {pad}
                  {keys}
                  {gap}
                  {first}
                </text>
                {under.map((text, place) => (
                  // A label's lines never reorder, so their place is their key.
                  // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                  <text key={place} fg={tokens["color.text"]}>
                    {text}
                  </text>
                ))}
              </box>
            );
          })}
        </box>
      ))}
      <text marginTop={1} fg={tokens["color.text"]}>
        {fitField(note, "block", width - indent)
          .map((text) => `${pad}${text}`)
          .join("\n")}
      </text>
    </box>
  );
};

export default HelpOverlay;
