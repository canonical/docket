import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { recordedNotifications } from "../testing/inbox.js";
import { recordedProvider } from "../testing/recorded.js";
import answerInbox from "./answerInbox.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerInbox", () => {
  it("lists the unread inbox, by repository", async () => {
    const provider = recordedProvider({
      notifications: async () => recordedNotifications,
    });
    const { session, out } = openSession(
      home,
      ["inbox", "--format", "plain"],
      provider,
    );
    expect(await answerInbox(session)).toBe(0);
    expect(out()).toMatch(/^inbox · unread · by repo\n/);
    expect(out()).toContain("4 unread");
    expect(out()).toContain("browser only");
  });

  it("takes the whole inbox and another grouping", async () => {
    const provider = recordedProvider({
      notifications: async () => recordedNotifications,
    });
    const { session, out } = openSession(
      home,
      ["inbox", "--all", "--by", "reason", "--format", "plain"],
      provider,
    );
    await answerInbox(session);
    expect(out()).toMatch(/^inbox · all · by reason\n/);
    expect(out()).toContain("4 unread · 1 read");
    expect(out()).toContain("\nreview requested\n");
  });

  it("answers a second call within the maximum age from the cache, making no request", async () => {
    const notifications = vi.fn(async () => recordedNotifications);
    const provider = recordedProvider({ notifications });
    await answerInbox(
      openSession(home, ["inbox", "--format", "plain"], provider).session,
    );
    const { session } = openSession(
      home,
      ["inbox", "--format", "plain"],
      provider,
    );
    await answerInbox(session);
    expect(notifications).toHaveBeenCalledTimes(1);
  });
});
