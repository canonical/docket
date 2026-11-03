import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField } from "../../fit/index.js";
import type { LoadingProps } from "./types.js";

/**
 * The line that says a read is under way whose progress cannot be
 * measured, wherever the list region waits on one: the first run's
 * fetch, and a windowed mode's read of its window. The caller names
 * what is being read, and places the line at its indent.
 *
 * `import { Loading } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.loading
 */
const Loading = ({ label, width }: LoadingProps): ReactNode => (
  <text fg={tokens["color.text"]}>{fitField(label, "line", width)}</text>
);

export default Loading;
