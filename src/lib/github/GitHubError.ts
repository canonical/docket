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

  constructor(code: ProviderErrorCode, message: string, recovery: string) {
    super(message);
    this.code = code;
    this.recovery = recovery;
  }
}
