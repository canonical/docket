import { type InboxAddress, inboxGroupings } from "../lib/inbox/index.js";
import fail from "./fail.js";
import type { Invocation } from "./types.js";

/**
 * The grouping and filter a call names for the inbox: the grouping `--by`
 * names, the first when it names none, and the whole inbox when `--all`
 * is given. Text mode and the terminal interface read the same address.
 *
 * @throws Error `USAGE_INVALID_VALUE` when `--by` names no inbox grouping.
 */
export default function chooseInboxAddress(
  invocation: Pick<Invocation, "by" | "all">,
): Pick<InboxAddress, "grouping" | "filter"> {
  const grouping =
    invocation.by === undefined
      ? inboxGroupings.at(0)
      : inboxGroupings.find((entry) => entry === invocation.by);
  if (!grouping) {
    fail(
      "USAGE_INVALID_VALUE",
      `\`--by\` takes ${inboxGroupings.join(", ")}, not \`${invocation.by}\`.`,
      "run docket inbox --help",
    );
  }
  return { grouping, filter: invocation.all ? "all" : "unread" };
}
