import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import type { KeyCommand } from "../../hooks/index.js";
import trimText from "../../trimText.js";
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
 * header that reads `help`. `?` shows and hides it.
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
          <text
            fg={tokens["color.text"]}
            attributes={tokens["typography.weight.bold"]}
          >
            {trimText(group, width)}
          </text>
          {lines.map((line) => {
            const keys = trimText(writeKeys(line), width - indent);
            const gap = " ".repeat(
              Math.max(1, keyColumn - Bun.stringWidth(keys)),
            );
            const room = width - indent - Bun.stringWidth(keys) - gap.length;
            return (
              <box key={line.label} flexDirection="column" flexShrink={0}>
                <text fg={tokens["color.text"]}>
                  {pad}
                  <span attributes={tokens["typography.weight.bold"]}>
                    {keys}
                  </span>
                  {gap}
                  {trimText(line.label, room)}
                </text>
                {line.notes.map((each) => (
                  <text key={each} fg={tokens["color.text"]}>
                    {notePad}
                    {trimText(each, width - notePad.length)}
                  </text>
                ))}
              </box>
            );
          })}
        </box>
      ))}
      <text marginTop={1} fg={tokens["color.text"]}>
        {pad}
        {trimText(note, width - indent)}
      </text>
    </box>
  );
};

export default HelpOverlay;
