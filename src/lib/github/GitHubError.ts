import type { ProviderError, ProviderErrorCode } from "../provider/index.js";

/**
 * An error the GitHub provider throws, with a named code and a recovery
 * step. Its message is one sentence, and nothing in it comes from a
 * request, so the token never reaches it.
 */
export default class GitHubError extends Error implements ProviderError {
  override readonly name = "GitHubError";
  readonly code: ProviderErrorCode;
  readonly recovery: string;
  readonly step?: string;

  /**
   * @param recovery What to do, or `{ step }` for a recovery that is
   * `step`, then to refresh.
   */
  constructor(
    code: ProviderErrorCode,
    message: string,
    recovery: string | { readonly step: string },
  ) {
    super(message);
    this.code = code;
    if (typeof recovery === "string") {
      this.recovery = recovery;
    } else {
      this.recovery = `${recovery.step}, then refresh`;
      this.step = recovery.step;
    }
  }
}
