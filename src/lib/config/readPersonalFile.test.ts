import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personalFile } from "../../testing/fixtures.js";
import readPersonalFile from "./readPersonalFile.js";

const home = vi.hoisted(() => ({ folder: "" }));
vi.mock("node:os", async (original) => ({
  ...(await original<typeof import("node:os")>()),
  homedir: () => home.folder,
}));

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-config-"));
  home.folder = join(root, "home");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function place(folder: string, text: string): Promise<string> {
  await mkdir(join(folder, "docket"), { recursive: true });
  const path = join(folder, "docket", "docket.yaml");
  await writeFile(path, text);
  return path;
}

describe("readPersonalFile", () => {
  it("reads the file in $XDG_CONFIG_HOME", async () => {
    const path = await place(join(root, "config"), personalFile);
    const read = await readPersonalFile({
      XDG_CONFIG_HOME: join(root, "config"),
    });
    expect(read.path).toBe(path);
    expect(read.outcome).toMatchObject({ ok: true });
  });

  it.each([
    ["is unset", undefined],
    ["is empty", ""],
    ["is not absolute", "config"],
  ])(
    "reads the file in ~/.config when $XDG_CONFIG_HOME %s",
    async (_, value) => {
      const path = await place(join(home.folder, ".config"), personalFile);
      const read = await readPersonalFile({ XDG_CONFIG_HOME: value });
      expect(read.path).toBe(path);
      expect(read.outcome).toMatchObject({ ok: true });
    },
  );

  it("reports no outcome when there is no file", async () => {
    const read = await readPersonalFile({ XDG_CONFIG_HOME: root });
    expect(read).toEqual({
      path: join(root, "docket", "docket.yaml"),
      outcome: undefined,
    });
  });

  it("gives the file's errors when it is invalid", async () => {
    await place(root, "version: 1\npeople: { alice: lead }\n");
    const read = await readPersonalFile({ XDG_CONFIG_HOME: root });
    expect(read.outcome).toMatchObject({
      ok: false,
      errors: [{ code: "CONFIG_UNKNOWN_GROUP" }],
    });
  });

  it("gives an error with a recovery line when the file cannot be read", async () => {
    await mkdir(join(root, "docket", "docket.yaml"), { recursive: true });
    const read = await readPersonalFile({ XDG_CONFIG_HOME: root });
    expect(read.outcome).toEqual({
      ok: false,
      errors: [
        {
          code: "CONFIG_UNREADABLE_FILE",
          message: `The personal file ${read.path} cannot be read.`,
          recovery: `Make ${read.path} a file you can read, or remove it.`,
        },
      ],
    });
  });
});
