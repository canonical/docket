import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import readCacheFile from "./readCacheFile.js";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-cache-"));
  file = join(root, "snapshots.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("readCacheFile", () => {
  it("reads nothing when there is no file, or it is not JSON, or of another layout", async () => {
    expect(await readCacheFile(file)).toBeUndefined();
    await writeFile(file, "{ not json");
    expect(await readCacheFile(file)).toBeUndefined();
    await writeFile(file, JSON.stringify({ format: 0, state: {} }));
    expect(await readCacheFile(file)).toBeUndefined();
  });
});
