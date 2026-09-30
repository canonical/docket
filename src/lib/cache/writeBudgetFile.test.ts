import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import readBudgetFile from "./readBudgetFile.js";
import writeBudgetFile from "./writeBudgetFile.js";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-budget-"));
  file = join(root, "docket", "budget.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("writeBudgetFile", () => {
  it("writes what readBudgetFile reads back, for its owner alone", async () => {
    const budgets = {
      graphql: fullBudget,
      rest: { ...fullBudget, remaining: 10 },
    };
    await writeBudgetFile(file, budgets);
    expect(await readBudgetFile(file)).toEqual(budgets);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readdir(join(root, "docket"))).toEqual(["budget.json"]);
  });

  it("leaves no temporary file behind when the write fails", async () => {
    // A folder where the file goes: the rename over it fails.
    await mkdir(file, { recursive: true });
    await expect(writeBudgetFile(file, {})).rejects.toThrow();
    expect(await readdir(join(root, "docket"))).toEqual(["budget.json"]);
  });
});
