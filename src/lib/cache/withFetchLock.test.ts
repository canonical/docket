import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("passes on a failure to take the lock that is not another holder's", async () => {
    await mkdir(directory, { recursive: true, mode: 0o500 });
    vi.useFakeTimers({ toFake: ["Date"] });
    const failing = withFetchLock(directory, async () => "ran").catch(
      (error: unknown) => error,
    );
    await pause(300);
    vi.setSystemTime(Date.now() + 120_000);
    expect(await failing).toMatchObject({ code: "EACCES" });
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
        await vi.waitFor(() => expect(said).toContain("waiting"), {
          timeout: 5_000,
        });
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
});
