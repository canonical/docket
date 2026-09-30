import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, utimes } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitUntil } from "../../testing/wait.js";
import withFetchLock from "./withFetchLock.js";

let root: string;
let directory: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-lock-"));
  directory = join(root, "docket");
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(root, { recursive: true, force: true });
});

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("withFetchLock", () => {
  it("runs one task at a time, each starting after the other ends", async () => {
    const steps: string[] = [];
    const task = (name: string) => async () => {
      steps.push(`${name} starts`);
      await pause(50);
      steps.push(`${name} ends`);
      return name;
    };
    const results = await Promise.all([
      withFetchLock(directory, task("first")),
      withFetchLock(directory, task("second")),
    ]);
    expect(results).toEqual(["first", "second"]);
    const one = steps[0]?.startsWith("first") ? "first" : "second";
    const two = one === "first" ? "second" : "first";
    expect(steps).toEqual([
      `${one} starts`,
      `${one} ends`,
      `${two} starts`,
      `${two} ends`,
    ]);
  });

  it("creates the cache folder, and leaves no lock once the task ends", async () => {
    await withFetchLock(directory, async () => undefined);
    expect(await readdir(directory)).toEqual([]);
  });

  it("gives up the lock when the task fails", async () => {
    await expect(
      withFetchLock(directory, async () => {
        throw new Error("no answer");
      }),
    ).rejects.toThrow("no answer");
    expect(await withFetchLock(directory, async () => "next")).toBe("next");
  });

  it("takes over at once a lock left untouched for 10 seconds, as by a process that died", async () => {
    const left = join(directory, "fetch.lock");
    await mkdir(left, { recursive: true });
    const untouched = new Date(Date.now() - 11_000);
    await utimes(left, untouched, untouched);
    const started = Date.now();
    expect(await withFetchLock(directory, async () => "ran")).toBe("ran");
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(await readdir(directory)).toEqual([]);
  });

  it("gives up with CACHE_LOCK_TIMED_OUT once another holder keeps the lock for two minutes", async () => {
    // A holder that keeps touching its lock, so it is never taken over.
    const held = join(directory, "fetch.lock");
    await mkdir(held, { recursive: true });
    const touched = new Date(Date.now() + 3_600_000);
    await utimes(held, touched, touched);
    vi.useFakeTimers({ toFake: ["Date"] });
    const waiting = withFetchLock(directory, async () => "ran").catch(
      (error: unknown) => error,
    );
    await pause(300);
    vi.setSystemTime(Date.now() + 120_000);
    expect(await waiting).toMatchObject({
      code: "CACHE_LOCK_TIMED_OUT",
      message:
        "Another docket process kept fetching for more than 120 seconds.",
      recovery:
        "try again once the other docket process has fetched, or close it",
    });
  });

  it("runs nothing and waits for nothing while another holder keeps the lock, when told what to give then", async () => {
    const held = Promise.withResolvers<void>();
    const holding = withFetchLock(directory, () => held.promise);
    await waitUntil(async () => {
      expect(await readdir(directory)).toHaveLength(1);
    });
    const task = vi.fn(async () => "ran");
    expect(await withFetchLock(directory, task, () => "held")).toBe("held");
    expect(task).not.toHaveBeenCalled();
    held.resolve();
    await holding;
    expect(await withFetchLock(directory, task, () => "held")).toBe("ran");
  });

  it("passes on a failure to take the lock that is not another holder's", async () => {
    await mkdir(directory, { recursive: true, mode: 0o500 });
    vi.useFakeTimers({ toFake: ["Date"] });
    const failing = withFetchLock(directory, async () => "ran").catch(
      (error: unknown) => error,
    );
    await pause(300);
    vi.setSystemTime(Date.now() + 120_000);
    expect(await failing).toMatchObject({ code: "EACCES" });
    await expect(
      withFetchLock(
        directory,
        async () => "ran",
        () => "held",
      ),
    ).rejects.toMatchObject({ code: "EACCES" });
  });

  it("runs the task again under a new lock when the lock is lost while it runs", async () => {
    let runs = 0;
    const result = await withFetchLock(directory, async () => {
      runs += 1;
      if (runs === 1) {
        // Another process that judged the lock abandoned removes it.
        await rm(join(directory, "fetch.lock"), { recursive: true });
        await pause(1_500);
      }
      return runs;
    });
    expect(result).toBe(2);
    expect(await readdir(directory)).toEqual([]);
  });

  it("leaves alone the lock another process took over while this one stalled, and runs the task again", async () => {
    let said = "";
    let taken: Promise<unknown> = Promise.resolve();
    let runs = 0;
    const result = await withFetchLock(directory, async () => {
      runs += 1;
      if (runs === 1) {
        const taker = spawn(process.execPath, [
          "src/testing/lockTaker.ts",
          directory,
        ]);
        taken = once(taker, "exit");
        taker.stdout.on("data", (chunk: Buffer) => {
          said += chunk.toString();
        });
        await waitUntil(() => expect(said).toContain("waiting"));
        // This process stalls, touching its lock no more, for longer than
        // the other process lets a lock go untouched before taking it.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4_000);
      }
      return runs;
    });
    await taken;
    expect(said.trim().split("\n")).toEqual(["waiting", "kept"]);
    expect(result).toBe(2);
    expect(await readdir(directory)).toEqual([]);
  }, 20_000);

  it("leaves no lock behind when the process ends while its task waits on an answer", async () => {
    const quitter = spawn(process.execPath, [
      "src/testing/lockQuitter.ts",
      directory,
    ]);
    let said = "";
    quitter.stdout.on("data", (chunk: Buffer) => {
      said += chunk.toString();
    });
    expect(await once(quitter, "exit")).toEqual([0, null]);
    expect(said.trim()).toBe("holding");
    expect(await readdir(directory)).toEqual([]);
    const started = Date.now();
    expect(await withFetchLock(directory, async () => "ran")).toBe("ran");
    expect(Date.now() - started).toBeLessThan(1_000);
  }, 20_000);

  it("leaves alone, as it exits, the lock another process took over while its failing task stalled", async () => {
    const start = (script: string) => {
      const child = spawn(process.execPath, [script, directory]);
      let said = "";
      child.stdout.on("data", (chunk: Buffer) => {
        said += chunk.toString();
      });
      return { exited: once(child, "exit"), said: () => said };
    };
    const holder = start("src/testing/lockHolder.ts");
    await waitUntil(() => expect(holder.said()).toContain("holding"));
    const taker = start("src/testing/lockTaker.ts");
    expect(await holder.exited).toEqual([3, null]);
    await taker.exited;
    expect(holder.said().trim().split("\n")).toEqual(["holding", "failed"]);
    expect(taker.said().trim().split("\n")).toEqual(["waiting", "kept"]);
    expect(await readdir(directory)).toEqual([]);
  }, 20_000);

  /**
   * Runs `withFetchLock` with the filesystem the lock library calls
   * wrapped, to put another process's takeover between the library's check
   * of the lock and its touch, so the library touches the other's lock and
   * keeps it as its own. `afterTakeover` then plays the other process.
   * Resolves to the task's result and the milliseconds from the takeover
   * to the end.
   */
  const adoptTakenLock = async (afterTakeover: () => Promise<void>) => {
    type Call = (path: string, ...rest: unknown[]) => unknown;
    const shared: { utimes: Call } = createRequire(import.meta.url)(
      "graceful-fs",
    );
    const { utimes: touch } = shared;
    const lockfile = join(directory, "fetch.lock");
    let armed = false;
    let takenAt = 0;
    shared.utimes = (path, ...rest) => {
      if (armed && path === lockfile) {
        armed = false;
        rmSync(lockfile, { recursive: true });
        mkdirSync(lockfile);
        takenAt = Date.now();
      }
      return touch(path, ...rest);
    };
    try {
      let runs = 0;
      const result = await withFetchLock(directory, async () => {
        runs += 1;
        if (runs === 1) {
          armed = true;
          await waitUntil(() => expect(takenAt).toBeGreaterThan(0));
          await afterTakeover();
        }
        return runs;
      });
      return { result, waited: Date.now() - takenAt };
    } finally {
      shared.utimes = touch;
    }
  };

  it("runs the task again at once when the process that took the lock over removes it before it hears of the touch", async () => {
    const { result, waited } = await adoptTakenLock(() =>
      rm(join(directory, "fetch.lock"), { recursive: true }),
    );
    expect(result).toBe(2);
    expect(waited).toBeLessThan(5_000);
    expect(await readdir(directory)).toEqual([]);
  }, 30_000);

  it("gives up after 10 seconds the lock it kept as its own, once the process that took it hears of the touch, and runs the task again", async () => {
    // The other process finds a time on its lock it did not set, and drops
    // its claim without removing the lock.
    const { result, waited } = await adoptTakenLock(async () => undefined);
    expect(result).toBe(2);
    expect(waited).toBeGreaterThanOrEqual(10_000);
    expect(await readdir(directory)).toEqual([]);
  }, 30_000);
});
