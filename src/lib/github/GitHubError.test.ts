import { describe, expect, it } from "vitest";
import GitHubError from "./GitHubError.js";

describe("GitHubError", () => {
  it("carries its code, its message and its recovery step", () => {
    const error = new GitHubError(
      "GITHUB_REQUEST_FAILED",
      "GitHub refused a request with status 404.",
      "check that your gh account can read the repository, then refresh",
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "GitHubError",
      code: "GITHUB_REQUEST_FAILED",
      message: "GitHub refused a request with status 404.",
      recovery:
        "check that your gh account can read the repository, then refresh",
    });
  });

  it("names itself in its text", () => {
    const error = new GitHubError("GH_NOT_SIGNED_IN", "No token.", "log in");
    expect(String(error)).toBe("GitHubError: No token.");
  });
});
