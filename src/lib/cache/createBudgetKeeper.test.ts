import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import type { Budgets } from "../provider/index.js";
import createBudgetKeeper from "./createBudgetKeeper.js";
import identifyFile from "./identifyFile.js";
import readBudgetFile from "./readBudgetFile.js";

let directory: string;
let file: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docket-keeper-"));
  file = join(directory, "budget", "4242.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const makeBudget = (remaining: number) => ({
  graphql: { ...fullBudget, remaining },
});

/** A keeper for a process whose answers so far reported `heard`. */
const createProcess = (heard: Budgets) => {
  const peer = { heard, told: 0 };
  const keeper = createBudgetKeeper({
    file,
    readOwn: () => peer.heard,
    publishFloor: () => {
      peer.told += 1;
    },
  });
  return { peer, keeper };
};

describe("createBudgetKeeper", () => {
  it("says the floor, and writes no file while it heard nothing", async () => {
    const { peer, keeper } = createProcess({});
    await keeper();
    expect(peer.told).toBe(1);
    expect(await readdir(directory)).toEqual([]);
  });

  it("writes what it heard to its own file", async () => {
    const { keeper } = createProcess(makeBudget(900));
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(900));
  });

  it("writes again only once what it heard changes", async () => {
    const { peer, keeper } = createProcess(makeBudget(900));
    await keeper();
    const written = await identifyFile(file);
    await keeper();
    expect(await identifyFile(file)).toBe(written);
    peer.heard = makeBudget(800);
    await keeper();
    expect(await identifyFile(file)).not.toBe(written);
    expect(await readBudgetFile(file)).toEqual(makeBudget(800));
  });

  it("leaves the last figure heard when keepings follow one another at once", async () => {
    const { peer, keeper } = createProcess({});
    const keeping: Promise<void>[] = [];
    for (const remaining of [950, 900, 850, 800, 750, 700]) {
      peer.heard = makeBudget(remaining);
      keeping.push(keeper());
    }
    await Promise.all(keeping);
    expect(await readBudgetFile(file)).toEqual(makeBudget(700));
  });

  it("drops a write that fails, and writes at the next keeping", async () => {
    await mkdir(join(file, "inside"), { recursive: true });
    const { keeper } = createProcess(makeBudget(900));
    await expect(keeper()).resolves.toBeUndefined();
    await rm(file, { recursive: true });
    await keeper();
    expect(await readBudgetFile(file)).toEqual(makeBudget(900));
  });
});
