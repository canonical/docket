import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import wrapText from "../../wrapText.js";
import type { NoticeProps } from "./types.js";

/** The indent of both lines, in display cells. */
const indent = 2;

/**
 * Joins the words of each command a step names after `run`, up to a
 * comma, with no-break spaces, so wrapping never splits a command someone
 * will type.
 */
const keepCommandsWhole = (step: string) =>
  step.replace(
    /\brun ([^,]+)/g,
    (_, command: string) => `run ${command.replaceAll(" ", " ")}`,
  );

/**
 * A reason and what to do about it. It stands in for the list when a
 * prerequisite is not met (`✗ docket needs the GitHub CLI (gh)`, `✗ gh is
 * not signed in to github.com`) and sits inside an editor when GitHub
 * refused a change.
 *
 * `import { Notice } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.component.notice
 */
const Notice = ({ reason, recovery, width }: NoticeProps): ReactNode => {
  const room = width - indent;
  return (
    <box flexDirection="column" paddingLeft={indent}>
      <text fg={tokens["color.text.error"]}>
        {wrapText(`✗ ${reason}`, room).join("\n")}
      </text>
      <text fg={tokens["color.text"]}>
        {wrapText(`Recovery: ${keepCommandsWhole(recovery)}`, room).join("\n")}
      </text>
    </box>
  );
};

export default Notice;
