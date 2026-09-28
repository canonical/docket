import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import wrapText from "../../wrapText.js";
import type { PaneProps } from "./types.js";

/**
 * The narrowest terminal docket draws its screen in, in display cells.
 * Every line of the screen is designed to fit it; below it, the pane
 * shows only a line saying so.
 */
const MIN_COLUMNS = 40;

/**
 * The pane is the whole terminal screen: one tmux column, drawn on a
 * character grid. It stretches with the column and never rearranges.
 *
 * `import { Pane } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.layout.pane
 */
const Pane = ({
  width,
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
    {width < MIN_COLUMNS ? (
      <text fg={tokens["color.text"]}>
        {wrapText(`docket needs ${MIN_COLUMNS} columns`, width).join("\n")}
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
