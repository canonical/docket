import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import type { NoticeProps } from "./types.js";
import wrapNotice from "./wrapNotice.js";

/** The indent of both lines, in display cells. */
const indent = 2;

/**
 * A reason and what to do about it. It stands in for the list when a
 * prerequisite is not met (`✗ docket needs the GitHub CLI (gh)`, `✗ gh is
 * not signed in to github.com`) and sits inside an editor when GitHub
 * refused a change. The reason and the recovery each keep rows of their
 * own, never drawn over each other.
 *
 * `import { Notice } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.notice
 */
const Notice = ({ reason, recovery, width }: NoticeProps): ReactNode => {
  const lines = wrapNotice(reason, recovery, width - indent);
  return (
    <box flexDirection="column" paddingLeft={indent}>
      {/* Each keeps its own rows, never drawn over the other. */}
      <text flexShrink={0} fg={tokens["color.text.error"]}>
        {lines.reason.join("\n")}
      </text>
      <text flexShrink={0} fg={tokens["color.text"]}>
        {lines.recovery.join("\n")}
      </text>
    </box>
  );
};

export default Notice;
