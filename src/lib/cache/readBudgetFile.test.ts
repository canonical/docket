import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import readBudgetFile from "./readBudgetFile.js";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-budget-"));
  file = join(root, "budget.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const resetAt = "2026-09-28T11:00:00.000Z";
const whole = { limit: 5000, remaining: 900, resetAt };

describe("readBudgetFile", () => {
  it("reads each budget the file holds whole, its reset as a date", async () => {
    await writeFile(file, JSON.stringify({ graphql: whole, rest: whole }));
    const read = { ...whole, resetAt: new Date(resetAt) };
    expect(await readBudgetFile(file)).toEqual({ graphql: read, rest: read });
  });

  it("reads none held in part, with a reset that is no date, or not a number", async () => {
    await writeFile(
      file,
      JSON.stringify({
        graphql: { ...whole, resetAt: "not a date" },
        rest: { ...whole, remaining: null },
      }),
    );
    expect(await readBudgetFile(file)).toEqual({});
    await writeFile(file, JSON.stringify({ rest: { limit: 5000, resetAt } }));
    expect(await readBudgetFile(file)).toEqual({});
  });

  it("reads nothing from no file, a file not JSON, or JSON of nothing", async () => {
    expect(await readBudgetFile(file)).toEqual({});
    await writeFile(file, "{ not json");
    expect(await readBudgetFile(file)).toEqual({});
    await writeFile(file, "null");
    expect(await readBudgetFile(file)).toEqual({});
  });
});
