import type { InboxNotification } from "../inbox/index.js";
import type { PageProgress } from "../provider/index.js";
import readNotification from "./readNotification.js";
import type { Client, RestNotification } from "./types.js";

/**
 * Reads the whole notification inbox, read and unread, leaving out the
 * ones marked done. Every subject kind is kept; the inbox shows the ones
 * docket can detail as threads and sends the rest to the browser.
 */
export default async function fetchNotifications(
  client: Client,
  onPage?: (progress: PageProgress) => void,
): Promise<readonly InboxNotification[]> {
  const notifications: InboxNotification[] = [];
  for await (const page of client.pages<RestNotification>(
    "GET /notifications",
    {
      all: true,
      is_done: false,
      per_page: 100,
    },
    onPage,
  )) {
    notifications.push(...page.map(readNotification));
  }
  return notifications;
}
