import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import type { Budgets } from "../provider/index.js";
import { lockName } from "./constants.js";
import createBudgetKeeper from "./createBudgetKeeper.js";
import isSame from "./isSame.js";
import mergeBudgets from "./mergeBudgets.js";
import readBudgetFile from "./readBudgetFile.js";
import withFetchLock from "./withFetchLock.js";
import writeBudgetFile from "./writeBudgetFile.js";

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
  const process = { mirror: {} as Budgets, heard, told };
  const readFigures = () => mergeBudgets(process.mirror, process.heard);
  const keeper = createBudgetKeeper({
    file,
    readFigures,
    isKept: () => isSame(readFigures(), process.mirror),
    adopt: (kept) => {
      process.mirror = kept;
    },
    publishFloor: () => told.push("floor"),
  });
  return { process, keeper };
};

describe("createBudgetKeeper", () => {
  it("says the floor, and touches no file when it heard nothing the file lacks", async () => {
    const { process, keeper } = createProcess({});
    await keeper();
    expect(process.told).toEqual(["floor"]);
    expect(await readdir(directory)).toEqual([]);
  });

  it("merges what it heard into the file, keeping a later report the file holds", async () => {
    await writeBudgetFile(file, makeBudget(800));
    const { process, keeper } = createProcess(makeBudget(900));
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    expect(process.mirror).toEqual(makeBudget(800));
    const lower = createProcess(makeBudget(700));
    await lower.keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(700));
  });

  it("keeps the figures while another process holds the fetch lock, and writes nothing to it", async () => {
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

  it("leaves the lowest figure of the window when processes keep falling figures together", async () => {
    const figures = [950, 900, 850, 800, 750, 700];
    await Promise.all(
      figures.map((remaining) => createProcess(makeBudget(remaining)).keeper()),
    );
    expect(await readBudgetFile(file)).toEqual(makeBudget(700));
  });

  it("runs one keeping at a time, which a call made meanwhile joins, saying the floor, and runs once more", async () => {
    const { process, keeper } = createProcess(makeBudget(900));
    const first = keeper();
    process.heard = makeBudget(800);
    const second = keeper();
    expect(second).toBe(first);
    // The call that joined says the floor its own figures reach.
    expect(process.told).toEqual(["floor", "floor"]);
    await first;
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    const third = keeper();
    expect(third).not.toBe(first);
    await third;
  });

  it("drops a keeping that fails, lets its lock go, and keeps at the next call", async () => {
    await mkdir(join(file, "inside"), { recursive: true });
    const { process, keeper } = createProcess(makeBudget(900));
    const first = keeper();
    const second = keeper();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    await rm(file, { recursive: true, force: true });
    await createProcess(makeBudget(800)).keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
    await keeper();
    expect(process.mirror).toEqual(makeBudget(800));
  });
});
