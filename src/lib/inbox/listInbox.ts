import type { Repo } from "../config/index.js";
import buildRow from "./buildRow.js";
import groupRows from "./groupRows.js";
import type {
  InboxAddress,
  InboxCounts,
  InboxList,
  InboxNotification,
  InboxRow,
} from "./types.js";

/** Unread first, then newest update first. */
const order = (a: InboxRow, b: InboxRow) =>
  Number(b.unread) - Number(a.unread) ||
  b.notification.updatedAt.getTime() - a.notification.updatedAt.getTime();

/**
 * Builds the inbox at `now`: the notifications the filter keeps, unread
 * first and then newest, in the sections of the address's grouping, with
 * the counts of the whole inbox and the words the counts line gives.
 *
 * @param repos The watched repositories, in the configuration's order,
 * which is the order of the `repo` sections and their short names.
 */
export default function listInbox(
  notifications: readonly InboxNotification[],
  repos: readonly Repo[],
  address: InboxAddress,
  now: Date,
): InboxList {
  const counts: InboxCounts = {
    unread: notifications.filter(({ unread }) => unread).length,
    read: notifications.filter(({ unread }) => !unread).length,
  };
  const visible =
    address.filter === "unread"
      ? notifications.filter(({ unread }) => unread)
      : notifications;
  const rows = visible
    .map((notification) => buildRow(notification, repos, now))
    .sort(order);
  const fields =
    address.filter === "all"
      ? [
          { text: `${counts.unread} unread`, kind: "words" as const },
          { text: `${counts.read} read`, kind: "words" as const },
        ]
      : [{ text: `${counts.unread} unread`, kind: "words" as const }];
  return {
    address,
    groups: groupRows(rows, address, repos),
    counts,
    summary: { fields },
  };
}
