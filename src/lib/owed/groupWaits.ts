import type { Repo } from "../config/index.js";
import groupRows from "./groupRows.js";
import type { OwedAddress, OwedList, WaitList } from "./types.js";

/**
 * Splits a measured list into the sections of an address's grouping. It
 * takes no instant, so changing the grouping reuses the rows as built.
 *
 * @param repos The watched repositories, in the configuration's order,
 * which is the order of the `repo` sections.
 */
export default function groupWaits(
  list: WaitList,
  address: OwedAddress,
  repos: readonly Repo[],
): OwedList {
  const { rows, counts, summary } = list;
  const groups = groupRows(rows, address.grouping, repos);
  return { address, groups, counts, summary };
}
