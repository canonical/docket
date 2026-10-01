import { mkdir, mkdtemp, rm, rmdir, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import identifyFile from "./identifyFile.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-identify-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("identifyFile", () => {
  it("names a folder the same while it stays, whatever its times", async () => {
    const folder = join(root, "fetch.lock");
    await mkdir(folder);
    const before = await identifyFile(folder);
    const later = new Date(Date.now() + 60_000);
    await utimes(folder, later, later);
    expect(await identifyFile(folder)).toBe(before);
  });

  it("names a folder made again at the same path apart from the one removed", async () => {
    const folder = join(root, "fetch.lock");
    await mkdir(folder);
    const first = await identifyFile(folder);
    await rmdir(folder);
    await mkdir(folder);
    expect(await identifyFile(folder)).not.toBe(first);
  });

  it("names nothing where nothing is", async () => {
    expect(await identifyFile(join(root, "missing"))).toBeUndefined();
  });
});
