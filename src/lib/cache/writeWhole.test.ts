import { readdirSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import identifyFile from "./identifyFile.js";
import writeWhole from "./writeWhole.js";

// Each look at a file, so a test can make one fail.
vi.mock("./identifyFile.js", async (original) => {
  const actual = await original<typeof import("./identifyFile.js")>();
  return { default: vi.fn(actual.default) };
});

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-whole-"));
  file = join(root, "docket", "data.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("writeWhole", () => {
  it("writes the text for its owner alone, in a folder only its owner enters", async () => {
    await writeWhole(file, "{}");
    expect(await readFile(file, "utf8")).toBe("{}");
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "docket"))).mode & 0o777).toBe(0o700);
  });

  it("names the file it writes while it still waits beside its place, which then takes it", async () => {
    let claimed: string | undefined;
    let waiting: string[] = [];
    await writeWhole(file, "[]", (written) => {
      claimed = written;
      waiting = readdirSync(join(root, "docket"));
    });
    expect(claimed).toBe(await identifyFile(file));
    expect(waiting.some((name) => /^data\.json\..+\.tmp$/.test(name))).toBe(
      true,
    );
    expect(await readFile(file, "utf8")).toBe("[]");
  });

  it("writes the file, naming nothing, when the file written cannot be looked at", async () => {
    vi.mocked(identifyFile).mockRejectedValueOnce(
      Object.assign(new Error("I/O error"), { code: "EIO" }),
    );
    const claim = vi.fn();
    await writeWhole(file, "{}", claim);
    expect(claim).toHaveBeenCalledWith(undefined);
    expect(await readFile(file, "utf8")).toBe("{}");
  });

  it("leaves the file as it was, and no temporary file, when the rename fails", async () => {
    await mkdir(file, { recursive: true });
    await expect(writeWhole(file, "{}")).rejects.toThrow();
    expect(await readdir(join(root, "docket"))).toEqual(["data.json"]);
  });
});
