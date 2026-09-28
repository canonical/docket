import { type OwedGrouping, owedGroupings } from "../lib/owed/index.js";
import type { Invocation } from "./types.js";

/**
 * The grouping owed opens on in the terminal interface: the one `docket
 * owed --by` names, so the call and the header name one address, as
 * `docket owed --by owner` and `owed · by owner` do; for any other call,
 * `none`, the grouping `docket` alone opens on.
 */
export default function chooseOwedGrouping(
  invocation: Pick<Invocation, "command" | "by">,
): OwedGrouping {
  const named =
    invocation.command === "owed"
      ? owedGroupings.find((grouping) => grouping === invocation.by)
      : undefined;
  return named ?? "none";
}
