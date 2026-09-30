import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { Notice } from "../../component/index.js";
import { pickerIndent as indent } from "./constants.js";
import describeOption from "./describeOption.js";
import listShownOptions from "./listShownOptions.js";
import type { PeoplePickerProps } from "./types.js";

/** What opens the filter line, before the typed text. */
const prompt = "filter: ";

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
  const { first, shown } = options
    ? listShownOptions(options, cursor)
    : { first: 0, shown: undefined };
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
            <box flexDirection="column">
              {describeOption({ owner, ticked }, room).map((line, row) => (
                // An option's lines never reorder, so their place is their key.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                <text key={row}>
                  {line.map(({ text, fg }, run) => (
                    // A line's runs never reorder, so their place is their key.
                    // biome-ignore lint/suspicious/noArrayIndexKey: see above.
                    <span key={run} fg={fg}>
                      {text}
                    </span>
                  ))}
                </text>
              ))}
            </box>
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
