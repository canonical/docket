import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import type { Budgets } from "../provider/index.js";
import { budgetLockTiming, lockName } from "./constants.js";
import createBudgetKeeper from "./createBudgetKeeper.js";
import identifyFile from "./identifyFile.js";
import isSame from "./isSame.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";
import withFetchLock from "./withFetchLock.js";
import writeBudgetFile from "./writeBudgetFile.js";

const clock = new Date("2026-09-28T10:00:00Z");
// The lock is watched, not replaced, so a test hears when the keeper asks
// for it.
vi.mock("proper-lockfile", async (importOriginal) => {
  const library = await importOriginal<typeof import("proper-lockfile")>();
  return { ...library, lock: vi.fn(library.lock) };
});
// Each look at the lock, so a test can make one fail.
vi.mock("./identifyFile.js", async (original) => {
  const actual = await original<typeof import("./identifyFile.js")>();
  return { default: vi.fn(actual.default) };
});

let directory: string;
let file: string;
let lockfilePath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docket-keeper-"));
  file = join(directory, "budget.json");
  lockfilePath = join(directory, "budget.json.lock");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const makeBudget = (remaining: number) => ({
  graphql: { ...fullBudget, remaining },
});

/**
 * Another process takes the budget lock over, as one does that judged it
 * abandoned: its own lock replaces this one, with its own time.
 */
const takeLockOver = () => {
  rmSync(lockfilePath, { recursive: true });
  mkdirSync(lockfilePath);
  const later = new Date(Date.now() + 2_000);
  utimesSync(lockfilePath, later, later);
};

/**
 * A keeper for one process that heard `heard`, as a cache makes it: its
 * mirror is what the file last gave it, and it records the floor said.
 */
const createProcess = (heard: Budgets, at = clock) => {
  const told: string[] = [];
  const peer: { mirror: Budgets; heard: Budgets; told: string[] } = {
    mirror: {},
    heard,
    told,
  };
  const readFigures = () => mergeBudgets(peer.mirror, peer.heard);
  const keeper = createBudgetKeeper({
    file,
    lockfilePath,
    readFigures,
    isKept: () => isSame(readFigures(), peer.mirror),
    adopt: (kept) => {
      peer.mirror = kept;
    },
    publishFloor: () => told.push("floor"),
    now: () => at,
  });
  return { peer, keeper };
};

describe("createBudgetKeeper", () => {
  it("says the floor, and touches no file when it heard nothing the file lacks", async () => {
    const { peer, keeper } = createProcess({});
    await keeper();
    expect(peer.told).toEqual(["floor"]);
    expect(await readdir(directory)).toEqual([]);
  });

  it("merges what it heard into the file, keeping a later report the file holds", async () => {
    await writeBudgetFile(file, makeBudget(800));
    const { peer, keeper } = createProcess(makeBudget(900));
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    expect(peer.mirror).toEqual(makeBudget(800));
    const lower = createProcess(makeBudget(700));
    await lower.keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(700));
  });

  it("keeps the figures while another process holds the fetch lock", async () => {
    const held = Promise.withResolvers<void>();
    const holding = withFetchLock(directory, () => held.promise);
    try {
      await waitUntil(async () => {
        expect(await readdir(directory)).toContain(lockName);
      });
      await createProcess(makeBudget(900)).keeper();
      expect(await readBudgetFile(file)).toEqual(makeBudget(900));
    } finally {
      held.resolve();
      await holding;
    }
  });

  it("drops a report the file holds that resets past GitHub's window, and writes it away", async () => {
    const far = {
      ...fullBudget,
      remaining: 0,
      resetAt: new Date("9999-12-31T00:00:00Z"),
    };
    await writeBudgetFile(file, { graphql: far });
    const { peer, keeper } = createProcess(makeBudget(3500));
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(3500));
    expect(peer.mirror).toEqual(makeBudget(3500));
  });

  it("writes a far report away though what remains of the file is what it heard", async () => {
    const rest = { ...fullBudget, remaining: 10 };
    const far = { ...fullBudget, resetAt: new Date("9999-12-31T00:00:00Z") };
    await writeBudgetFile(file, { graphql: far, rest });
    await createProcess({ rest }).keeper();
    expect(await readBudgetFile(file)).toEqual({ rest });
  });

  it("judges a reset by the time it is given, not the machine's", async () => {
    const at = new Date("2031-01-01T10:00:00Z");
    const near = {
      ...fullBudget,
      remaining: 700,
      resetAt: new Date("2031-01-01T10:30:00Z"),
    };
    await writeBudgetFile(file, { graphql: near });
    const rest = { ...fullBudget, remaining: 9 };
    await createProcess({ rest }, at).keeper();
    expect(await readBudgetFile(file)).toEqual({ graphql: near, rest });
  });

  it("takes over a lock a dead process left, and keeps the figures", async () => {
    await mkdir(lockfilePath);
    await createProcess(makeBudget(900)).keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(900));
  }, 15_000);

  it("writes nothing after another process took its lock over, and leaves that lock alone", async () => {
    await writeBudgetFile(file, makeBudget(1000));
    let takenOver = false;
    const keeper = createBudgetKeeper({
      file,
      lockfilePath,
      // Between its read and its write, another process takes the lock
      // over and writes a later figure.
      readFigures: () => {
        if (!takenOver) {
          takenOver = true;
          takeLockOver();
          writeFileSync(file, JSON.stringify(makeBudget(800)));
        }
        return makeBudget(900);
      },
      isKept: () => false,
      adopt: () => {},
      publishFloor: () => {},
      now: () => clock,
    });
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    expect(await readdir(directory)).toContain("budget.json.lock");
  });

  it("leaves alone a lock another process took over after its write", async () => {
    const keeper = createBudgetKeeper({
      file,
      lockfilePath,
      readFigures: () => makeBudget(900),
      isKept: () => false,
      // Once the figures are written, another process takes the lock over.
      adopt: () => {
        takeLockOver();
      },
      publishFloor: () => {},
      now: () => clock,
    });
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(900));
    expect(await readdir(directory)).toContain("budget.json.lock");
  });

  it("leaves no timer behind once a takeover is heard of", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const keeper = createBudgetKeeper({
        file,
        lockfilePath,
        readFigures: () => makeBudget(900),
        isKept: () => false,
        adopt: () => {
          takeLockOver();
        },
        publishFloor: () => {},
        now: () => clock,
      });
      let ended = false;
      const keeping = keeper().then(() => {
        ended = true;
      });
      // The library hears of the takeover at its next touch of the lock.
      await waitUntil(async () => {
        await vi.advanceTimersByTimeAsync(100);
        expect(ended).toBe(true);
      });
      await keeping;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the lowest figure of the window when processes keep falling figures together", async () => {
    const figures = [950, 900, 850, 800, 750, 700];
    await Promise.all(
      figures.map((remaining) => createProcess(makeBudget(remaining)).keeper()),
    );
    expect(await readBudgetFile(file)).toEqual(makeBudget(700));
  });

  it("runs one keeping at a time, which a call made meanwhile joins, saying the floor", async () => {
    const { peer, keeper } = createProcess(makeBudget(900));
    const first = keeper();
    peer.heard = makeBudget(800);
    const second = keeper();
    expect(second).toBe(first);
    // The call that joined says the floor its own figures reach.
    expect(peer.told).toEqual(["floor", "floor"]);
    await first;
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    const third = keeper();
    expect(third).not.toBe(first);
    await third;
  });

  it("keeps the figures heard while a keeping runs in a second run, once the first has read its own", async () => {
    let adopted = 0;
    let joined: Promise<void> | undefined;
    const peer: { mirror: Budgets; heard: Budgets } = {
      mirror: {},
      heard: makeBudget(900),
    };
    const readFigures = () => mergeBudgets(peer.mirror, peer.heard);
    const keeper = createBudgetKeeper({
      file,
      lockfilePath,
      readFigures,
      isKept: () => isSame(readFigures(), peer.mirror),
      adopt: (kept) => {
        peer.mirror = kept;
        adopted += 1;
        // A figure heard after the first run read its own joins it.
        if (adopted === 1) {
          peer.heard = makeBudget(800);
          joined = keeper();
        }
      },
      publishFloor: () => {},
      now: () => clock,
    });
    await keeper();
    await joined;
    expect(adopted).toBe(2);
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
  });

  it("reads the file once it holds the file's lock, so a figure written before then stays", async () => {
    await writeBudgetFile(file, makeBudget(1000));
    // Held as another live process holds it, touched in time.
    const release = await lock(file, {
      stale: budgetLockTiming.stale,
      update: budgetLockTiming.update,
      realpath: false,
      lockfilePath,
    });
    vi.mocked(lock).mockClear();
    const { peer, keeper } = createProcess(makeBudget(900));
    const keeping = keeper();
    try {
      // The keeper has asked for the lock, which another process holds
      // while it writes a lower figure.
      await waitUntil(() => expect(lock).toHaveBeenCalled());
      await writeBudgetFile(file, makeBudget(800));
    } finally {
      await release();
    }
    await keeping;
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    expect(peer.mirror).toEqual(makeBudget(800));
  });

  it("drops a keeping that fails, lets its lock go, and keeps at the next call", async () => {
    await mkdir(join(file, "inside"), { recursive: true });
    const { peer, keeper } = createProcess(makeBudget(900));
    const first = keeper();
    const second = keeper();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    await rm(file, { recursive: true, force: true });
    await createProcess(makeBudget(800)).keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    await keeper();
    expect(peer.mirror).toEqual(makeBudget(800));
  });

  it("drops a keeping whose lock cannot be let go, and keeps at the next call", async () => {
    const library =
      await vi.importActual<typeof import("proper-lockfile")>(
        "proper-lockfile",
      );
    vi.mocked(lock).mockImplementationOnce(async (...args) => {
      const release = await library.lock(...args);
      return async () => {
        await release();
        throw Object.assign(new Error("released"), { code: "ERELEASED" });
      };
    });
    await expect(
      createProcess(makeBudget(900)).keeper(),
    ).resolves.toBeUndefined();
    await createProcess(makeBudget(800)).keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
  });

  it("writes, and lets its lock go, when a look at the lock fails and heals at once", async () => {
    const failure = Object.assign(new Error("I/O error"), { code: "EIO" });
    const keeper = createBudgetKeeper({
      file,
      lockfilePath,
      // The look at the lock before the write fails.
      readFigures: () => {
        vi.mocked(identifyFile).mockRejectedValueOnce(failure);
        return makeBudget(900);
      },
      isKept: () => false,
      adopt: () => {},
      publishFloor: () => {},
      now: () => clock,
    });
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(900));
    expect(await readdir(directory)).toEqual(["budget.json"]);
  });
});
