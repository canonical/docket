import type { ReactNode } from "react";
import { tokens } from "../../../tokens/index.js";
import { fitField, measureText } from "../../fit/index.js";
import type { PaneHeaderProps } from "./types.js";

/**
 * The first line of the pane. It says where you are: the current mode's
 * name on the left and that mode's own address on the right, read like
 * the text address, then its fixed sort, dimmed, as context. It never
 * names the other mode; there is no tab strip. The mode's name never
 * gives way; the sort and the address's parts, `24h · by kind`, are
 * docket's words and are never cut: when they do not all fit, the sort
 * leaves first, then the address's parts leave whole, the first part
 * first, as the window leaves before the grouping.
 *
 * `import { PaneHeader } from "../lib/ui/index.js";`
 *
 * @implements apps_docket.subcomponent.pane-header
 */
const PaneHeader = ({
  title,
  address,
  sort,
  width,
}: PaneHeaderProps): ReactNode => {
  const left = fitField(title, "line", width);
  const separator = ` ${tokens["glyph.separator"]} `;
  const parts = address
    ? address.text
        .split(separator)
        .map((text) => fitField({ ...address, text }, "line", width))
    : [];
  const sorted = sort ? fitField(sort, "line", width) : "";
  // A space at least between the mode and the address.
  const room = width - measureText(left) - 1;
  const fits =
    sorted !== "" && measureText([...parts, sorted].join(separator)) <= room;
  while (parts.length > 0 && measureText(parts.join(separator)) > room) {
    parts.shift();
  }
  const shown = [
    ...parts.map((text) => ({ text, fg: tokens["color.text"] })),
    ...(fits ? [{ text: sorted, fg: tokens["color.text.muted"] }] : []),
  ];
  const right = shown.map(({ text }) => text).join(separator);
  const gap = Math.max(0, width - measureText(left) - measureText(right));
  return (
    <text fg={tokens["color.text"]}>
      {left}
      {" ".repeat(gap)}
      {shown.map(({ text, fg }, place) => (
        // The parts never reorder, so their place is their key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above.
        <span key={place}>
          {place > 0 && separator}
          <span fg={fg}>{text}</span>
        </span>
      ))}
    </text>
  );
};

export default PaneHeader;
