import type { Repo } from "../config/index.js";
import groupThreads from "./groupThreads.js";
import type { ActivityAddress, ActivityList, EventList } from "./types.js";

/**
 * Splits a gathered list into the sections of an address's grouping. It
 * takes no instant, so changing the grouping reuses the rows as built.
 *
 * @param repos The watched repositories, in the configuration's order,
 * which is the order of the `repo` sections.
 */
export default function groupEvents(
  list: EventList,
  address: ActivityAddress,
  repos: readonly Repo[],
): ActivityList {
  const { rows, counts, summary } = list;
  const groups = groupThreads(rows, address.grouping, repos);
  return { address, groups, counts, summary };
}
