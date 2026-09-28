import type { CacheErrorCode } from "./types.js";

/**
 * An error of the cache itself rather than of its provider, with a named
 * code and a recovery step.
 */
export default class CacheError extends Error {
  override readonly name = "CacheError";
  readonly code: CacheErrorCode;
  /** What to do so the next attempt works. */
  readonly recovery: string;

  constructor(code: CacheErrorCode, message: string, recovery: string) {
    super(message);
    this.code = code;
    this.recovery = recovery;
  }
}
