import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import readBudgetFolder from "./readBudgetFolder.js";
import writeBudgetFile from "./writeBudgetFile.js";

let folder: string;

beforeEach(async () => {
  folder = join(await mkdtemp(join(tmpdir(), "docket-folder-")), "budget");
  await mkdir(folder);
});

afterEach(async () => {
  await rm(join(folder, ".."), { recursive: true, force: true });
});

const before = new Date("2026-09-28T10:00:00Z");
const budget = (remaining: number, resetAt = fullBudget.resetAt) => ({
  ...fullBudget,
  remaining,
  resetAt,
});

describe("readBudgetFolder", () => {
  it("takes, of every process's file, the latest report of each kind", async () => {
    const later = new Date("2026-09-28T11:30:00Z");
    await writeBudgetFile(join(folder, "1.json"), {
      graphql: budget(900),
      rest: budget(4000, later),
    });
    await writeBudgetFile(join(folder, "2.json"), { graphql: budget(800) });
    expect(await readBudgetFolder(folder, before)).toEqual({
      graphql: budget(800),
      rest: budget(4000, later),
    });
  });

  it("passes over a file whose reports have all reset, a torn file, and anything not a budget file", async () => {
    const passed = new Date("2026-09-28T09:00:00Z");
    await writeBudgetFile(join(folder, "1.json"), {
      graphql: budget(100, passed),
      rest: budget(100, passed),
    });
    await writeFile(join(folder, "2.json"), '{"graphql":{"limit":50');
    await writeFile(join(folder, "3.json.1234.tmp"), "{}");
    await writeBudgetFile(join(folder, "4.json"), { graphql: budget(900) });
    expect(await readBudgetFolder(folder, before)).toEqual({
      graphql: budget(900),
    });
  });

  it("drops a report that resets past GitHub's window", async () => {
    await writeBudgetFile(join(folder, "1.json"), {
      graphql: budget(0, new Date("9999-12-31T00:00:00Z")),
    });
    expect(await readBudgetFolder(folder, before)).toEqual({});
  });

  it("reads no budget while there is no folder", async () => {
    expect(await readBudgetFolder(join(folder, "missing"), before)).toEqual({});
  });

  it("removes a file whose reports have all reset, and never a file with a report still live", async () => {
    const passed = new Date("2026-09-28T09:00:00Z");
    await writeBudgetFile(join(folder, "spent.json"), {
      graphql: budget(100, passed),
      rest: budget(100, passed),
    });
    await writeBudgetFile(join(folder, "half.json"), {
      graphql: budget(100, passed),
      rest: budget(4000),
    });
    await writeBudgetFile(join(folder, "live.json"), { graphql: budget(900) });
    await readBudgetFolder(folder, before);
    expect((await readdir(folder)).sort()).toEqual(["half.json", "live.json"]);
  });

  it("reads the others when a file whose reports have all reset cannot be removed", async () => {
    const passed = new Date("2026-09-28T09:00:00Z");
    await writeBudgetFile(join(folder, "spent.json"), {
      graphql: budget(100, passed),
    });
    await writeBudgetFile(join(folder, "live.json"), { graphql: budget(900) });
    await chmod(folder, 0o500);
    try {
      expect(await readBudgetFolder(folder, before)).toEqual({
        graphql: budget(900),
      });
      expect((await readdir(folder)).sort()).toEqual([
        "live.json",
        "spent.json",
      ]);
    } finally {
      await chmod(folder, 0o700);
    }
  });
});
