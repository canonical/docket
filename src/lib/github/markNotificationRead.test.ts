import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import markNotificationRead from "./markNotificationRead.js";

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

describe("markNotificationRead", () => {
  it("marks the thread read with the id GitHub gave", async () => {
    github.rest("PATCH /notifications/threads/12", { status: 205 });
    await settle(
      markNotificationRead(createClient(token, "github.com", "1.2.3"), "12"),
    );
    expect(github.sent.at(0)?.method).toBe("PATCH");
    expect(github.sent.at(0)?.url.pathname).toBe("/notifications/threads/12");
  });
});
