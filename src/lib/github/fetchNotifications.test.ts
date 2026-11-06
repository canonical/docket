import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import fetchNotifications from "./fetchNotifications.js";
import type { RestNotification } from "./types.js";

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

const raw = (id: string): RestNotification => ({
  id,
  unread: true,
  reason: "mention",
  updated_at: "2026-09-28T09:00:00Z",
  last_read_at: null,
  subject: {
    title: "Fix parser",
    url: "https://api.github.com/repos/example-org/example-repo/issues/12",
    latest_comment_url: "",
    type: "Issue",
  },
  repository: {
    full_name: "example-org/example-repo",
    html_url: "https://github.com/example-org/example-repo",
  },
  url: `https://api.github.com/notifications/threads/${id}`,
  subscription_url: "",
});

describe("fetchNotifications", () => {
  it("reads the whole inbox, read and unread, without the notifications marked done", async () => {
    github.rest("GET /notifications", { body: [raw("1"), raw("2")] });
    const read = await settle(
      fetchNotifications(createClient(token, "github.com", "1.2.3")),
    );
    expect(read.map(({ id }) => id)).toEqual(["1", "2"]);
    expect(github.sent.at(0)?.url.searchParams.get("all")).toBe("true");
    expect(github.sent.at(0)?.url.searchParams.get("is_done")).toBe("false");
    expect(github.sent.at(0)?.url.searchParams.get("per_page")).toBe("50");
  });

  it("stops with the provider's named error when GitHub refuses", async () => {
    github.rest("GET /notifications", {
      status: 403,
      body: { message: "Forbidden" },
    });
    await expect(
      settle(fetchNotifications(createClient(token, "github.com", "1.2.3"))),
    ).rejects.toMatchObject({ code: "GITHUB_REQUEST_FAILED" });
  });
});
