import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { minColumns, minLines } from "../../constants.js";
import { fitField } from "../../fit/index.js";
import type { PaneProps } from "./types.js";

/**
 * The pane is the whole terminal screen: one tmux column, drawn on a
 * character grid. It stretches with the column and never rearranges.
 * Narrower than `minColumns`, or shorter than `minLines`, it shows only
 * one wrapped line saying what it needs, the width first.
 *
 * `import { Pane } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.layout.pane
 */
const Pane = ({
  width,
  height,
  header,
  children,
  counts,
  status,
  keys,
  help,
}: PaneProps): ReactNode => (
  <box
    flexDirection="column"
    width="100%"
    height="100%"
    backgroundColor={tokens["color.background"]}
  >
    {width < minColumns || height < minLines ? (
      <text fg={tokens["color.text"]}>
        {fitField(
          {
            text:
              width < minColumns
                ? `docket needs ${minColumns} columns`
                : `docket needs ${minLines} lines`,
            kind: "words",
          },
          "block",
          width,
        ).join("\n")}
      </text>
    ) : (
      <>
        {header}
        {help ?? (
          <>
            <box
              flexDirection="column"
              flexGrow={1}
              flexShrink={1}
              overflow="hidden"
            >
              {children}
            </box>
            {counts ?? <box height={1} />}
            {status}
            {keys}
          </>
        )}
      </>
    )}
  </box>
);

export default Pane;
