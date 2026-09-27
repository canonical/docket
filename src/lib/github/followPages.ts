import type { Client, RestResponse } from "./types.js";

const nextLink = /<([^>]+)>;\s*rel="next"/;

/**
 * Reads a REST list page by page, following each answer's link to the
 * next page, until `visit` returns false or no page is left.
 *
 * @param visit Reads one page's items; returns whether to read the next.
 */
export default async function followPages<T>(
  client: Client,
  route: string,
  parameters: Record<string, unknown>,
  visit: (items: readonly T[]) => boolean,
): Promise<void> {
  let request: [string, Record<string, unknown>] | undefined = [
    route,
    parameters,
  ];
  while (request) {
    const answer: RestResponse<T[]> = await client.request<T[]>(...request);
    const next = nextLink.exec(String(answer.headers.link ?? ""))?.[1];
    request = visit(answer.data) && next ? [`GET ${next}`, {}] : undefined;
  }
}
