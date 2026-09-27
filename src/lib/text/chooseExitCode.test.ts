import { expect, it } from "vitest";
import chooseExitCode from "./chooseExitCode.js";

it.each([
  "GH_NOT_INSTALLED",
  "GH_NOT_SIGNED_IN",
  "GH_TIMED_OUT",
  "CONFIG_INVALID_DURATION",
  "CONFIG_UNREADABLE_FILE",
  "USAGE_UNKNOWN_FLAG",
  "USAGE_INVALID_REFERENCE",
] as const)(
  "exits 2 for %s, a missing prerequisite or an invalid call",
  (code) => {
    expect(chooseExitCode(code)).toBe(2);
  },
);

it.each([
  "GITHUB_RATE_LIMITED",
  "GITHUB_REQUEST_FAILED",
  "GITHUB_TIMED_OUT",
  "CACHE_LOCK_TIMED_OUT",
  "CACHE_REFRESH_FAILED",
  "THREAD_NOT_FOUND",
] as const)("exits 3 for %s, when no data answers", (code) => {
  expect(chooseExitCode(code)).toBe(3);
});
