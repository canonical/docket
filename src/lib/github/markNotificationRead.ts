import type { Client } from "./types.js";

/** Marks one notification thread read, as opening it in GitHub's inbox does. */
export default async function markNotificationRead(
  client: Client,
  id: string,
): Promise<void> {
  await client.request("PATCH /notifications/threads/{thread_id}", {
    thread_id: id,
  });
}
