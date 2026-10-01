import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import watchBudgetFolder from "./watchBudgetFolder.js";
import writeBudgetFile from "./writeBudgetFile.js";

let root: string;
let folder: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-watch-budget-"));
  folder = join(root, "docket", "budget");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const at = new Date("2026-09-28T10:00:00Z");
const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const budget = (remaining: number) => ({
  graphql: { ...fullBudget, remaining },
});

describe("watchBudgetFolder", () => {
  it("hands over what another process's file tells, and nothing of its own file or of other names", async () => {
    const adopt = vi.fn();
    const stop = watchBudgetFolder(folder, "1.json", () => at, adopt);
    try {
      await writeBudgetFile(join(folder, "1.json"), budget(100));
      await writeFile(join(folder, "notes.txt"), JSON.stringify(budget(200)));
      await writeFile(join(folder, "3.json.tmp"), JSON.stringify(budget(300)));
      await writeBudgetFile(join(folder, "2.json"), budget(900));
      await waitUntil(() => {
        expect(adopt).toHaveBeenCalledWith(budget(900));
      });
      await pause(100);
      for (const [read] of adopt.mock.calls) {
        expect([budget(900), {}]).toContainEqual(read);
      }
    } finally {
      stop();
    }
  });

  it("hands over nothing once stopped", async () => {
    const adopt = vi.fn();
    watchBudgetFolder(folder, "1.json", () => at, adopt)();
    await writeBudgetFile(join(folder, "2.json"), budget(900));
    await pause(100);
    expect(adopt).not.toHaveBeenCalled();
  });
});
