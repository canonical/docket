import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitUntil } from "../../testing/wait.js";
import { lockName } from "./constants.js";
import createBudgetKeeper from "./createBudgetKeeper.js";
import withFetchLock from "./withFetchLock.js";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docket-keeper-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

/** A keeper over a file that `kept` says holds the figures, or not. */
const keep = (kept: () => boolean) => {
  const steps: string[] = [];
  const keeper = createBudgetKeeper({
    directory,
    isKept: () => {
      steps.push("judge");
      return kept();
    },
    load: async () => {
      steps.push("load");
    },
    save: async () => {
      steps.push("save");
    },
    publishFloor: () => steps.push("floor"),
  });
  return { keeper, steps };
};

describe("createBudgetKeeper", () => {
  it("says the floor, and writes nothing when the file holds every figure", async () => {
    const { keeper, steps } = keep(() => true);
    await keeper();
    expect(steps).toEqual(["floor", "judge"]);
    expect(await readdir(directory)).toEqual([]);
  });

  it("loads under the fetch lock before it writes the figures the file lacks", async () => {
    let judged = 0;
    const { keeper, steps } = keep(() => {
      judged += 1;
      return false;
    });
    await keeper();
    expect(steps).toEqual(["floor", "judge", "load", "judge", "save"]);
    expect(judged).toBe(2);
  });

  it("writes nothing when the load finds the figures another process wrote", async () => {
    let loaded = false;
    const save = vi.fn(async () => {});
    const keeper = createBudgetKeeper({
      directory,
      isKept: () => loaded,
      load: async () => {
        loaded = true;
      },
      save,
      publishFloor: () => {},
    });
    await keeper();
    expect(save).not.toHaveBeenCalled();
  });

  it("runs one keeping at a time, which a call made meanwhile joins and runs once more", async () => {
    const loading = Promise.withResolvers<void>();
    const loads = vi.fn(() => loading.promise);
    const keeper = createBudgetKeeper({
      directory,
      isKept: () => false,
      load: loads,
      save: async () => {},
      publishFloor: () => {},
    });
    const first = keeper();
    await waitUntil(() => expect(loads).toHaveBeenCalledOnce());
    const second = keeper();
    const third = keeper();
    expect(second).toBe(first);
    expect(third).toBe(first);
    loading.resolve();
    await first;
    expect(loads).toHaveBeenCalledTimes(2);
    await keeper();
    expect(loads).toHaveBeenCalledTimes(3);
  });

  it("goes on at once, writing nothing, while another process holds the fetch lock", async () => {
    const held = Promise.withResolvers<void>();
    const holding = withFetchLock(directory, () => held.promise);
    try {
      await waitUntil(async () => {
        expect(await readdir(directory)).toContain(lockName);
      });
      const { keeper, steps } = keep(() => false);
      const waited = new Promise((resolve) =>
        setTimeout(() => resolve("waited for the lock"), 5_000),
      );
      const outcome = await Promise.race([
        keeper().then(() => "went on"),
        waited,
      ]);
      expect(outcome).toBe("went on");
      expect(steps).toEqual(["floor", "judge"]);
    } finally {
      held.resolve();
      await holding;
    }
  });
});
