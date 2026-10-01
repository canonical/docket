import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField } from "../../fit/index.js";
import type { EmptyStateProps } from "./types.js";

/** The indent of the message, in display cells. */
const indent = 2;

/**
 * What the list area shows when there is nothing to list: `nothing owed`.
 *
 * `import { EmptyState } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.empty_state
 */
const EmptyState = ({ message, width }: EmptyStateProps): ReactNode => (
  <text fg={tokens["color.text"]}>
    {" ".repeat(indent)}
    {fitField(message, "line", width - indent)}
  </text>
);

export default EmptyState;
