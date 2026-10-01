import type { SentRequest } from "./types.js";

/**
 * The threads a request reads the details of, as `owner/name#number`: one
 * for each alias of a query aliased per thread, such as
 * `t0: repository(owner: "o", name: "n") { pullRequest(number: 4) … }`,
 * and none for any other request.
 */
export default function listThreads({ body }: SentRequest): string[] {
  return [
    ...String(body.query ?? "").matchAll(
      /\bt\d+: repository\(owner: "([^"]+)", name: "([^"]+)"\) \{ \w+\(number: (\d+)\)/g,
    ),
  ].map(([, owner, name, number]) => `${owner}/${name}#${number}`);
}
