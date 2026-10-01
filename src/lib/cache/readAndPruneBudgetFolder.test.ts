import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import { leftoverAge } from "./constants.js";
import readAndPruneBudgetFolder from "./readAndPruneBudgetFolder.js";
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

describe("readAndPruneBudgetFolder", () => {
  it("takes, of every process's file, the latest report of each kind", async () => {
    const later = new Date("2026-09-28T11:30:00Z");
    await writeBudgetFile(join(folder, "1.json"), {
      graphql: budget(900),
      rest: budget(4000, later),
    });
    await writeBudgetFile(join(folder, "2.json"), { graphql: budget(800) });
    expect(await readAndPruneBudgetFolder(folder, before)).toEqual({
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
    expect(await readAndPruneBudgetFolder(folder, before)).toEqual({
      graphql: budget(900),
    });
  });

  it("drops a report that resets past GitHub's window", async () => {
    await writeBudgetFile(join(folder, "1.json"), {
      graphql: budget(0, new Date("9999-12-31T00:00:00Z")),
    });
    expect(await readAndPruneBudgetFolder(folder, before)).toEqual({});
  });

  it("reads no budget while there is no folder", async () => {
    expect(
      await readAndPruneBudgetFolder(join(folder, "missing"), before),
    ).toEqual({});
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
    await readAndPruneBudgetFolder(folder, before);
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
      expect(await readAndPruneBudgetFolder(folder, before)).toEqual({
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

  it("removes a temporary file older than an hour, which no process is writing, and keeps a younger one", async () => {
    const old = join(folder, "1.json.0001.tmp");
    const young = join(folder, "2.json.0002.tmp");
    await writeFile(old, "{}");
    await writeFile(young, "{}");
    const leftAt = new Date(before.getTime() - leftoverAge);
    await utimes(old, leftAt, leftAt);
    await utimes(young, before, before);
    // One that cannot be looked at is left.
    await symlink(join(folder, "gone"), join(folder, "3.json.0003.tmp"));
    await readAndPruneBudgetFolder(folder, before);
    expect((await readdir(folder)).sort()).toEqual([
      "2.json.0002.tmp",
      "3.json.0003.tmp",
    ]);
  });
});
