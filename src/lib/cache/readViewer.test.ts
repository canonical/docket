import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeProvider, providerError } from "../../testing/provider.js";
import type { Provider } from "../provider/index.js";
import createCache from "./createCache.js";

const repo = "example-org/example-repo";
const minute = 60_000;

let root: string;
let clock: Date;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-viewer-"));
  clock = new Date("2026-09-28T10:00:00Z");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const open = (provider: Provider, directory = join(root, "docket")) =>
  createCache({ provider, repos: [repo], directory, now: () => clock });

describe("the viewer's login in createCache", () => {
  it("reads the login once, then answers from the cache in every process while it is younger than the maximum age", async () => {
    const provider = fakeProvider({ viewer: vi.fn(async () => "alice") });
    const first = await open(provider).readViewer(5 * minute);
    expect(first).toEqual({ login: "alice", syncedAt: clock });
    clock = new Date(clock.getTime() + 4 * minute);
    // Another process, reading the file this one wrote.
    expect(await open(provider).readViewer(5 * minute)).toEqual(first);
    expect(provider.viewer).toHaveBeenCalledOnce();
    clock = new Date(clock.getTime() + minute);
    await open(provider).readViewer(5 * minute);
    expect(provider.viewer).toHaveBeenCalledTimes(2);
  });

  it("throws the provider's error, and CACHE_UNUSABLE for a folder it cannot make", async () => {
    const offline = fakeProvider({
      viewer: () => Promise.reject(providerError("GITHUB_UNREACHABLE")),
    });
    await expect(open(offline).readViewer(5 * minute)).rejects.toMatchObject({
      code: "GITHUB_UNREACHABLE",
    });
    const file = join(root, "file");
    await writeFile(file, "");
    const unusable = open(
      fakeProvider({ viewer: async () => "alice" }),
      join(file, "docket"),
    );
    await expect(unusable.readViewer(5 * minute)).rejects.toMatchObject({
      code: "CACHE_UNUSABLE",
    });
  });
});
