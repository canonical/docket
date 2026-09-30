import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { Notice } from "../../component/index.js";
import { fitPieces, markPerson } from "../../fit/index.js";
import { pickerIndent as indent, shownOptions } from "./constants.js";
import type { PeoplePickerProps } from "./types.js";

/** What opens the filter line, before the typed text. */
const prompt = "filter: ";

/**
 * The first option drawn: the cursor sits in the middle of the options
 * drawn where it can, and the last ones fill the lines at the end.
 */
const findFirstShown = (cursor: number, count: number) =>
  Math.max(
    0,
    Math.min(cursor - Math.floor(shownOptions / 2), count - shownOptions),
  );

/**
 * The editor for the two writes docket makes: assign (`a`) and request
 * review (`r`). It replaces the accordion area under the selected row, and
 * the header above reads `assigning pragma#1240` or `requesting review
 * pragma#1201`. It sets the full list: unticking removes a person. On
 * success it closes; when GitHub refuses, it stays open with the reason.
 *
 * `import { PeoplePicker } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.pattern.people_picker
 */
const PeoplePicker = ({
  filter,
  onFilter,
  options,
  cursor,
  notice,
  width,
}: PeoplePickerProps): ReactNode => {
  const room = width - indent;
  const first = options ? findFirstShown(cursor, options.length) : 0;
  const shown = options?.slice(first, first + shownOptions);
  return (
    <box flexDirection="column" flexShrink={0}>
      <box flexDirection="row" paddingLeft={indent} height={1}>
        <text fg={tokens["color.text"]}>{prompt}</text>
        {/* The typed text is the user's own, so it needs no sanitizing. */}
        <input
          focused
          value={filter}
          onInput={onFilter}
          width={room - prompt.length}
          textColor={tokens["color.text"]}
          focusedTextColor={tokens["color.text"]}
          backgroundColor={tokens["color.background"]}
          focusedBackgroundColor={tokens["color.background"]}
          cursorColor={tokens["color.text"]}
        />
      </box>
      {shown ? (
        shown.map(({ owner, ticked }, place) => (
          <box
            key={owner.text}
            paddingLeft={indent}
            backgroundColor={
              first + place === cursor
                ? tokens["color.background.selected"]
                : undefined
            }
          >
            <text>
              {fitPieces(
                [
                  {
                    text: `${tokens[ticked ? "glyph.ticked" : "glyph.unticked"]} `,
                    fg: tokens["color.text"],
                  },
                  markPerson(owner),
                ],
                room,
              ).map(({ text, fg }, run) => (
                // A line's runs never reorder, so their place is their key.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                <span key={run} fg={fg}>
                  {text}
                </span>
              ))}
            </text>
          </box>
        ))
      ) : (
        <box paddingLeft={indent}>
          <text fg={tokens["color.text"]}>loading…</text>
        </box>
      )}
      {notice && <Notice {...notice} width={width} />}
    </box>
  );
};

export default PeoplePicker;
