import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, rateLimit, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import fetchViewer from "./fetchViewer.js";

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
  settle(fetchViewer(createClient(token, "github.com", "1.2.3")));

describe("fetchViewer", () => {
  it("gives the login of the account the token belongs to", async () => {
    github.graphql("Viewer", {
      body: { data: { rateLimit, viewer: { login: "alice" } } },
    });
    expect(await read()).toBe("alice");
  });

  it("stops with GH_NOT_SIGNED_IN when GitHub refuses the token", async () => {
    github.graphql("Viewer", {
      status: 401,
      body: { message: "Bad credentials" },
    });
    await expect(read()).rejects.toMatchObject({ code: "GH_NOT_SIGNED_IN" });
  });
});
