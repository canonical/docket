import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitUntil } from "../../testing/wait.js";
import holdLock from "./holdLock.js";
import identifyFile from "./identifyFile.js";

// Each look at the lock, so a test can make one fail.
vi.mock("./identifyFile.js", async (original) => {
  const actual = await original<typeof import("./identifyFile.js")>();
  return { default: vi.fn(actual.default) };
});

const stale = 3_000;

let directory: string;
let lockfilePath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docket-hold-"));
  lockfilePath = join(directory, "example.lock");
});

afterEach(async () => {
  vi.useRealTimers();
  vi.clearAllMocks();
  await rm(directory, { recursive: true, force: true });
});

/**
 * A lock as the library takes it: a folder, removed when let go. It hands
 * out how to tell it that another process took the lock over.
 */
const createLock = () => {
  const held = { released: 0, hear: () => {} };
  const take = async (onCompromised: () => void) => {
    held.hear = onCompromised;
    await mkdir(lockfilePath);
    return async () => {
      held.released += 1;
      await rm(lockfilePath, { recursive: true });
    };
  };
  return { held, take };
};

/** Another process takes the lock over: its folder replaces this one's. */
const takeOver = async () => {
  await rm(lockfilePath, { recursive: true });
  await mkdir(lockfilePath);
};

describe("holdLock", () => {
  it("runs the task under the lock and lets the lock go", async () => {
    const { held, take } = createLock();
    const result = await holdLock(take, lockfilePath, stale, async (isOwn) =>
      isOwn(),
    );
    expect(result).toEqual({ lost: false, value: true });
    expect(held.released).toBe(1);
    expect(await readdir(directory)).toEqual([]);
  });

  it("fails with the task's failure once it lets the lock go", async () => {
    const { held, take } = createLock();
    const failure = new Error("failed");
    await expect(
      holdLock(take, lockfilePath, stale, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(held.released).toBe(1);
  });

  it("tells the task its lock was taken over, and leaves the other process's lock once the library hears", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { held, take } = createLock();
    let ended = false;
    const holding = holdLock(take, lockfilePath, stale, async (isOwn) => {
      await takeOver();
      return isOwn();
    }).then((result) => {
      ended = true;
      return result;
    });
    await waitUntil(() => expect(vi.getTimerCount()).toBe(1));
    held.hear();
    // It ends with no time passing, well before the stale time.
    await waitUntil(() => expect(ended).toBe(true));
    expect(await holding).toEqual({ lost: true, value: false });
    expect(held.released).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(await readdir(directory)).toEqual(["example.lock"]);
  });

  it("counts the lock taken over once the library says so, though the folder looks the same", async () => {
    const { held, take } = createLock();
    const result = await holdLock(take, lockfilePath, stale, async (isOwn) => {
      held.hear();
      return isOwn();
    });
    expect(result).toEqual({ lost: true, value: false });
    expect(held.released).toBe(0);
  });

  it("tells the task its lock was taken over when the library said so before the first look", async () => {
    const { held, take } = createLock();
    const result = await holdLock(
      async (onCompromised) => {
        const release = await take(onCompromised);
        onCompromised();
        return release;
      },
      lockfilePath,
      stale,
      async (isOwn) => isOwn(),
    );
    expect(result).toEqual({ lost: true, value: false });
    expect(held.released).toBe(0);
  });

  it("lets a lock taken over go at the stale time when the library never hears, and not before", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { held, take } = createLock();
    let ended = false;
    const holding = holdLock(take, lockfilePath, stale, takeOver).then(
      (result) => {
        ended = true;
        return result;
      },
    );
    await waitUntil(() => expect(vi.getTimerCount()).toBe(1));
    await vi.advanceTimersByTimeAsync(stale - 1);
    expect(ended).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await holding).toMatchObject({ lost: true });
    expect(held.released).toBe(1);
  });

  it("counts the lock its own when a look at it fails, which heals at once", async () => {
    const { held, take } = createLock();
    const failure = Object.assign(new Error("I/O error"), { code: "EIO" });
    const result = await holdLock(take, lockfilePath, stale, async (isOwn) => {
      vi.mocked(identifyFile).mockRejectedValueOnce(failure);
      return isOwn();
    });
    expect(result).toEqual({ lost: false, value: true });
    expect(held.released).toBe(1);
  });

  it("counts the lock its own when it cannot be looked at once taken", async () => {
    const { held, take } = createLock();
    const failure = Object.assign(new Error("I/O error"), { code: "EIO" });
    vi.mocked(identifyFile).mockRejectedValueOnce(failure);
    const result = await holdLock(take, lockfilePath, stale, async (isOwn) =>
      isOwn(),
    );
    expect(result).toEqual({ lost: false, value: true });
    expect(held.released).toBe(1);
  });
});
