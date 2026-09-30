import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField } from "../../fit/index.js";
import type { CountsLineProps } from "./types.js";

/**
 * The line under the list: a summary of the list only, never of docket's
 * own state (that is the status line's).
 *
 * `import { CountsLine } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.counts_line
 */
const CountsLine = ({ summary, width }: CountsLineProps): ReactNode => (
  <text fg={tokens["color.text"]}>{fitField(summary, "line", width)}</text>
);

export default CountsLine;
