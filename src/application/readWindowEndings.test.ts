import { describe, expect, it, vi } from "vitest";
import { timeEndings } from "../lib/endings/index.js";
import {
  recordedFinished,
  recordedNow,
  recordedSettings,
  recordedWatched,
} from "../testing/recorded.js";
import readWindowEndings from "./readWindowEndings.js";

const window = { amount: 72, unit: "h" } as const;
const read = async (repo: string) =>
  recordedFinished.filter((thread) => thread.repo === repo);

describe("readWindowEndings", () => {
  it("gives each repository's finished threads by its owner/name, timed against the window", async () => {
    const endings = await readWindowEndings(
      read,
      recordedWatched(),
      window,
      recordedNow,
    );
    expect([...endings.keys()]).toEqual([
      "example-org/example-repo",
      "example-org/example-docs",
    ]);
    expect(endings.get("example-org/example-docs")).toEqual(
      timeEndings(
        recordedFinished.filter(({ number }) => number === 3),
        window,
        recordedSettings,
      ),
    );
  });

  it("asks for them far enough back to cover the window's working time on each repository's clock", async () => {
    const asked = vi.fn(async () => []);
    const twoDays = {
      ...recordedSettings,
      time: { ...recordedSettings.time, workdays: ["mon", "tue"] as const },
    };
    await readWindowEndings(
      asked,
      [...recordedWatched().slice(0, 1), ...recordedWatched(twoDays).slice(1)],
      window,
      recordedNow,
    );
    expect(asked.mock.calls).toEqual([
      ["example-org/example-repo", new Date("2026-09-20T10:00:00Z")],
      ["example-org/example-docs", new Date("2026-09-13T10:00:00Z")],
    ]);
  });
});
