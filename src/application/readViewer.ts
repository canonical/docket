import type { Provider } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import isNamedError from "./isNamedError.js";

/** The login gh is signed in with, when GitHub gave it, and why not. */
export interface ReadViewer {
  readonly viewer?: string;
  readonly warnings: readonly Problem[];
}

/**
 * Reads from GitHub the login gh is signed in with, which an answer marks
 * as `you`. When GitHub fails, such as with no answer from the network,
 * the answer still comes from the cached data, marks nobody as `you`,
 * and carries the failure as a warning.
 *
 * @throws Error any failure GitHub or docket gives no name, a defect.
 * @note Impure: reads GitHub.
 */
export default async function readViewer(
  provider: Provider,
): Promise<ReadViewer> {
  try {
    return { viewer: await provider.viewer(), warnings: [] };
  } catch (error) {
    if (!isNamedError(error)) throw error;
    const { code, message, recovery } = error;
    return { warnings: [{ code, message, recovery }] };
  }
}
