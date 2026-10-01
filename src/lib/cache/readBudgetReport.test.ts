import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import readBudgetReport from "./readBudgetReport.js";
import writeBudgetFile from "./writeBudgetFile.js";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-report-"));
  file = join(root, "4242.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const at = new Date("2026-09-28T10:00:00Z");
const budget = (remaining: number, resetAt = fullBudget.resetAt) => ({
  ...fullBudget,
  remaining,
  resetAt,
});

describe("readBudgetReport", () => {
  it("tells what a file reports, less a report past GitHub's window", async () => {
    const far = new Date("9999-12-31T00:00:00Z");
    await writeBudgetFile(file, { graphql: budget(900), rest: budget(0, far) });
    expect(await readBudgetReport(file, at)).toEqual({ graphql: budget(900) });
  });

  it("tells nothing of a file whose reports have all reset", async () => {
    const passed = new Date("2026-09-28T09:00:00Z");
    await writeBudgetFile(file, { graphql: budget(100, passed) });
    expect(await readBudgetReport(file, at)).toEqual({});
  });

  it("tells nothing of a torn file, or of one that is gone", async () => {
    await writeFile(file, '{"graphql":{"limit":50');
    expect(await readBudgetReport(file, at)).toEqual({});
    expect(await readBudgetReport(join(root, "gone.json"), at)).toEqual({});
  });
});
