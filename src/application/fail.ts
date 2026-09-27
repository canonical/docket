import type { ErrorCode } from "../lib/text/index.js";

/**
 * Stops the call with a named error, which `run` prints with its recovery
 * and turns into the exit code its code gives.
 */
export default function fail(
  code: ErrorCode,
  message: string,
  recovery: string,
): never {
  throw Object.assign(new Error(message), { code, recovery });
}
