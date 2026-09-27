import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { recordedProvider } from "../testing/recorded.js";
import answerActivity from "./answerActivity.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerActivity", () => {
  it("lists the events of the first configured window, by kind, asking GitHub for them", async () => {
    const provider = recordedProvider({
      events: vi.fn(recordedProvider().events),
    });
    const { session, out } = openSession(home, ["activity"], provider);
    expect(await answerActivity(session)).toBe(0);
    expect(out()).toMatch(/^# activity · 72h · by kind\n/);
    expect(out()).toContain("\n2 threads · 4 events\n\n## ISSUES\n");
    expect(provider.events).toHaveBeenCalledTimes(2);
  });

  it("takes another configured window and grouping", async () => {
    const { session, out } = openSession(home, [
      "activity",
      "--window",
      "1w",
      "--by",
      "none",
    ]);
    await answerActivity(session);
    expect(out()).toMatch(/^# activity · 1w\n/);
  });

  it("refuses a window the configuration does not list", async () => {
    const { session } = openSession(home, ["activity", "--window", "24h"]);
    await expect(answerActivity(session)).rejects.toMatchObject({
      code: "USAGE_INVALID_VALUE",
      message:
        "`--window` takes one of the configured windows, 72h, 1w, not `24h`.",
    });
  });
});
