import type { ErrorCode } from "./types.js";

/**
 * The exit code of a call that stopped on `code`: 2 when a prerequisite
 * is missing (gh, the personal configuration) or the call itself is not
 * valid, which the user fixes before calling again; 3 when no data could
 * be obtained or a change was refused.
 */
export default function chooseExitCode(code: ErrorCode): 2 | 3 {
  return /^(GH|CONFIG|USAGE)_/.test(code) ? 2 : 3;
}
