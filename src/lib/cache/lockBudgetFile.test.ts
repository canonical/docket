import { chmod, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitUntil } from "../../testing/wait.js";
import { budgetLockTiming } from "./constants.js";
import lockBudgetFile from "./lockBudgetFile.js";

// The lock is watched, not replaced, so a test counts each try.
vi.mock("proper-lockfile", async (importOriginal) => {
  const library = await importOriginal<typeof import("proper-lockfile")>();
  return { ...library, lock: vi.fn(library.lock) };
});

let directory: string;
let file: string;
let lockPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docket-budget-lock-"));
  file = join(directory, "budget.json");
  lockPath = join(directory, "budget.json.lock");
  vi.mocked(lock).mockClear();
});

afterEach(async () => {
  await chmod(directory, 0o700);
  await rm(directory, { recursive: true, force: true });
});

/** Holds the lock as another live process does, touching it in time. */
const holdLock = () =>
  lock(file, {
    stale: budgetLockTiming.stale,
    update: budgetLockTiming.update,
    realpath: false,
    lockfilePath: lockPath,
  });

describe("lockBudgetFile", () => {
  it("takes the lock beside a file that need not exist, and lets it go", async () => {
    const release = await lockBudgetFile(file, lockPath, () => {});
    expect(await readdir(directory)).toEqual(["budget.json.lock"]);
    await release();
    expect(await readdir(directory)).toEqual([]);
  });

  it("tries again while another process holds the lock, and takes it once let go", async () => {
    const releaseOther = await holdLock();
    vi.mocked(lock).mockClear();
    const taking = lockBudgetFile(file, lockPath, () => {});
    await waitUntil(() =>
      expect(vi.mocked(lock).mock.calls.length).toBeGreaterThan(1),
    );
    await releaseOther();
    const release = await taking;
    await release();
  });

  it("fails at once on any failure but a lock held, such as a folder it cannot write", async () => {
    await chmod(directory, 0o500);
    await expect(
      lockBudgetFile(file, lockPath, () => {}),
    ).rejects.toMatchObject({ code: "EACCES" });
    expect(lock).toHaveBeenCalledOnce();
  });

  it("gives up once it has waited its whole wait while a live process holds the lock", async () => {
    const releaseOther = await holdLock();
    try {
      await expect(
        lockBudgetFile(file, lockPath, () => {}),
      ).rejects.toMatchObject({ code: "ELOCKED" });
    } finally {
      await releaseOther();
    }
  }, 15_000);

  it("waits longer in all than a lock takes to go stale", () => {
    expect(budgetLockTiming.wait).toBeGreaterThan(budgetLockTiming.stale);
  });
});
