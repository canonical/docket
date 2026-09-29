import type { Problem } from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";
import type { Session } from "./types.js";

/** The login gh is signed in with, when GitHub gave it, and why not. */
export interface ReadViewer {
  readonly viewer?: string;
  readonly warnings: readonly Problem[];
}

/**
 * Reads the login gh is signed in with, which an answer marks as `you`,
 * through the shared cache, no older than the call's maximum age, as the
 * threads are: an agent calling in a loop asks GitHub for it at most
 * once in that age, and a login held that long answers offline with no
 * warning. When GitHub fails, such as with no answer from the network,
 * the answer still comes from the cached data, marks nobody as `you`,
 * and carries the failure as a warning.
 *
 * @throws Error any failure GitHub or docket gives no name, a defect.
 * @note Impure: reads the cache, which asks GitHub when the login it
 * holds is too old.
 */
export default async function readViewer({
  cache,
  invocation,
}: Pick<Session, "cache" | "invocation">): Promise<ReadViewer> {
  try {
    const { login } = await cache.readViewer(invocation.maxAge);
    return { viewer: login, warnings: [] };
  } catch (error) {
    if (!isNamedError(error)) throw error;
    const { code, message, recovery } = error;
    return { warnings: [{ code, message, recovery }] };
  }
}
