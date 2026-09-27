import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeGitHub,
  rateLimit,
  repository,
  settle,
  token,
} from "../../testing/github.js";
import createClient from "./createClient.js";
import fetchFile from "./fetchFile.js";

let github: ReturnType<typeof fakeGitHub>;

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const read = () =>
  settle(
    fetchFile(
      createClient(token, "github.com", "1.2.3"),
      "example-org/example-repo",
      ".github/docket.yaml",
    ),
  );

describe("fetchFile", () => {
  it("gives the text of the file on the default branch", async () => {
    github.graphql("File", repository({ object: { text: "version: 1\n" } }));
    expect(await read()).toBe("version: 1\n");
    expect(github.sent.at(0)?.body?.variables).toEqual({
      owner: "example-org",
      name: "example-repo",
      expression: "HEAD:.github/docket.yaml",
    });
  });

  it.each([
    ["no file at the path", { object: null }],
    ["a folder at the path", { object: {} }],
    ["a file with no text, such as an image", { object: { text: null } }],
  ])("reads as absent when there is %s", async (_case, fields) => {
    github.graphql("File", repository(fields));
    expect(await read()).toBeUndefined();
  });

  it("reads as absent when GitHub does not show the repository", async () => {
    github.graphql("File", {
      body: {
        data: { rateLimit, repository: null },
        errors: [
          {
            type: "NOT_FOUND",
            path: ["repository"],
            message: "Could not resolve.",
          },
        ],
      },
    });
    expect(await read()).toBeUndefined();
  });
});
