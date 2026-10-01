import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import type { Budgets } from "../provider/index.js";
import { budgetLockTiming, lockName } from "./constants.js";
import createBudgetKeeper from "./createBudgetKeeper.js";
import isSame from "./isSame.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";
import withFetchLock from "./withFetchLock.js";
import writeBudgetFile from "./writeBudgetFile.js";

const clock = new Date("2026-09-28T10:00:00Z");
let directory: string;
let file: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docket-keeper-"));
  file = join(directory, "budget.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const makeBudget = (remaining: number) => ({
  graphql: { ...fullBudget, remaining },
});

/**
 * A keeper for one process that heard `heard`, as a cache makes it: its
 * mirror is what the file last gave it, and it records the floor said.
 */
const createProcess = (heard: Budgets) => {
  const told: string[] = [];
  const peer: { mirror: Budgets; heard: Budgets; told: string[] } = {
    mirror: {},
    heard,
    told,
  };
  const readFigures = () => mergeBudgets(peer.mirror, peer.heard);
  const keeper = createBudgetKeeper({
    file,
    readFigures,
    isKept: () => isSame(readFigures(), peer.mirror),
    adopt: (kept) => {
      peer.mirror = kept;
    },
    publishFloor: () => told.push("floor"),
    now: () => clock,
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

  it("takes over a lock a dead process left, and keeps the figures", async () => {
    await mkdir(`${file}.lock`);
    await createProcess(makeBudget(900)).keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(900));
  }, 15_000);

  it("writes nothing after another process took its lock over, and leaves that lock alone", async () => {
    await writeBudgetFile(file, makeBudget(1000));
    const lockPath = `${file}.lock`;
    let takenOver = false;
    const keeper = createBudgetKeeper({
      file,
      // Between its read and its write, another process takes the lock
      // over and writes a later figure.
      readFigures: () => {
        if (!takenOver) {
          takenOver = true;
          rmSync(lockPath, { recursive: true });
          mkdirSync(lockPath);
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

  it("reads and writes the file only while it holds the file's lock", async () => {
    await writeBudgetFile(file, makeBudget(1000));
    let holding = true;
    const readWhileHeld: boolean[] = [];
    const peer: { mirror: Budgets } = { mirror: {} };
    const keeper = createBudgetKeeper({
      file,
      readFigures: () => {
        readWhileHeld.push(holding);
        return makeBudget(900);
      },
      isKept: () => false,
      adopt: (kept) => {
        peer.mirror = kept;
      },
      publishFloor: () => {},
      now: () => clock,
    });
    const release = await lock(file, { ...budgetLockTiming, realpath: false });
    const keeping = keeper();
    await new Promise((resolve) => setTimeout(resolve, 200));
    holding = false;
    await release();
    await keeping;
    expect(readWhileHeld).toEqual([false]);
    expect(peer.mirror).toEqual(makeBudget(900));
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
});
