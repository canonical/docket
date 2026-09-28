import { describe, expect, it } from "vitest";
import describeFailure from "./describeFailure.js";
import GitHubError from "./GitHubError.js";

const described = (error: unknown) => {
  const failure = describeFailure(error, "github.com");
  return {
    code: failure.code,
    message: failure.message,
    recovery: failure.recovery,
    step: failure.step,
  };
};

describe("describeFailure", () => {
  it("gives a GitHubError that keeps no link to what was thrown", () => {
    const thrown = {
      status: 500,
      request: { headers: { authorization: "x" } },
    };
    const failure = describeFailure(thrown, "github.com");
    expect(failure).toBeInstanceOf(GitHubError);
    expect(failure.cause).toBeUndefined();
    expect(JSON.stringify({ ...failure })).not.toContain("authorization");
  });

  it("reads a refused token as not signed in, naming the host", () => {
    expect(described({ status: 401 })).toEqual({
      code: "GH_NOT_SIGNED_IN",
      message: "GitHub refused the token gh gave for github.com.",
      recovery: "run gh auth login",
    });
  });

  describe("rate limits", () => {
    it("names when the limit resets, from the headers", () => {
      expect(
        described({
          status: 403,
          response: {
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1790593200",
            },
          },
        }),
      ).toEqual({
        code: "GITHUB_RATE_LIMITED",
        message:
          "GitHub is refusing requests from this account until 2026-09-28T11:00:00.000Z, because its rate limit is reached.",
        recovery:
          "wait for the limit to reset at 2026-09-28T11:00:00.000Z, then refresh",
        step: "wait for the limit to reset at 2026-09-28T11:00:00.000Z",
      });
    });

    it("reads a message naming the rate limit, without a reset time", () => {
      expect(
        described({ status: 403, message: "API rate limit exceeded" }),
      ).toEqual({
        code: "GITHUB_RATE_LIMITED",
        message:
          "GitHub is refusing requests from this account, because its rate limit is reached.",
        recovery: "wait for the limit to reset, then refresh",
        step: "wait for the limit to reset",
      });
    });

    it("reads a GraphQL error of the rate-limited type", () => {
      expect(
        described({ errors: [{ type: "RATE_LIMITED", message: "slow down" }] })
          .code,
      ).toBe("GITHUB_RATE_LIMITED");
    });
  });

  it("repeats the error GraphQL reports in its answer", () => {
    expect(
      described({
        errors: [
          {
            type: "NOT_FOUND",
            message: "Could not resolve to a Repository.",
          },
        ],
      }),
    ).toEqual({
      code: "GITHUB_REQUEST_FAILED",
      message:
        "GitHub answered with an error: Could not resolve to a Repository.",
      recovery:
        "check that your gh account can read the repository, then refresh",
      step: "check that your gh account can read the repository",
    });
  });

  describe("a change GitHub will not make", () => {
    it("gives GitHub's reason, with each detail its answer lists", () => {
      expect(
        described({
          status: 422,
          response: {
            data: {
              message: "Validation Failed",
              errors: [
                { resource: "PullRequest", code: "custom" },
                { message: "dave is not a collaborator" },
              ],
            },
          },
        }),
      ).toEqual({
        code: "GITHUB_REQUEST_FAILED",
        message:
          "GitHub refused the request: Validation Failed: dave is not a collaborator.",
        recovery: "change what GitHub's reason names, then refresh",
        step: "change what GitHub's reason names",
      });
    });

    it("keeps the full stop GitHub's reason ends with", () => {
      expect(
        described({
          status: 422,
          response: { data: { message: "dave is not a collaborator." } },
        }).message,
      ).toBe("GitHub refused the request: dave is not a collaborator.");
    });

    it("names the status when GitHub words no reason", () => {
      expect(
        described({ status: 422, response: { data: { message: "" } } }).message,
      ).toBe("GitHub refused a request with status 422.");
    });
  });

  it("names the status of any other refusal", () => {
    expect(described({ status: 404 })).toEqual({
      code: "GITHUB_REQUEST_FAILED",
      message: "GitHub refused a request with status 404.",
      recovery:
        "check that your gh account can read the repository, then refresh",
      step: "check that your gh account can read the repository",
    });
  });

  it("names GITHUB_UNREACHABLE when the request got no answer, naming the host", () => {
    const refused = { status: 500, cause: new TypeError("Unable to connect.") };
    expect(described(refused)).toEqual({
      code: "GITHUB_UNREACHABLE",
      message: "docket could not reach github.com: the request got no answer.",
      recovery:
        "check the network connection and https://www.githubstatus.com, then refresh",
      step: "check the network connection and https://www.githubstatus.com",
    });
  });

  it("reads a server error or no answer as GitHub out of reach", () => {
    const outOfReach = {
      code: "GITHUB_REQUEST_FAILED",
      message: "docket could not get an answer from GitHub.",
      recovery:
        "check the network connection and https://www.githubstatus.com, then refresh",
      step: "check the network connection and https://www.githubstatus.com",
    };
    expect(described({ status: 502 })).toEqual(outOfReach);
    expect(described(new TypeError("fetch failed"))).toEqual(outOfReach);
    expect(described(undefined)).toEqual(outOfReach);
  });
});
