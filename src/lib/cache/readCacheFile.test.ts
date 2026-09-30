import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cacheFormat } from "./constants.js";
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
    // Threads in layout 1 carry no address on GitHub.
    await writeFile(file, JSON.stringify({ format: 1, state: {} }));
    expect(await readCacheFile(file)).toBeUndefined();
    // Threads in layout 2 carry no time of their last change.
    await writeFile(file, JSON.stringify({ format: 2, state: {} }));
    expect(await readCacheFile(file)).toBeUndefined();
    // Threads in layout 3 carry no text of what was written, and no requester.
    await writeFile(file, JSON.stringify({ format: 3, state: {} }));
    expect(await readCacheFile(file)).toBeUndefined();
  });

  it("reads no start of a full refresh that is not a date", async () => {
    await writeFile(
      file,
      JSON.stringify({ format: cacheFormat, state: {}, fullRefreshAt: "soon" }),
    );
    expect(await readCacheFile(file)).toEqual({
      state: {},
      fullRefreshAt: undefined,
    });
  });
});
