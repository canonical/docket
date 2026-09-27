import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../package.json" with { type: "json" };
import type { Context } from "./types.js";

const run = vi.fn(async (_context: Context) => 3);
vi.mock("./run.js", () => ({ default: run }));
const createProvider = vi.fn(async () => ({}));
vi.mock("../lib/github/index.js", () => ({ createProvider }));

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("main", () => {
  it("answers the process's arguments and exits with the answer's code", async () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const writeError = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await import("./main.js");
    expect(process.exitCode).toBe(3);
    const [context] = run.mock.calls.at(0) ?? [];
    if (!context) throw new Error("run was called");
    expect(context).toMatchObject({
      args: process.argv.slice(2),
      environment: process.env,
      interactive: process.stdout.isTTY === true,
      version: manifest.version,
    });
    context.write("out");
    context.writeError("err");
    expect(write).toHaveBeenCalledWith("out");
    expect(writeError).toHaveBeenCalledWith("err");
    expect(context.now()).toBeInstanceOf(Date);
    await context.connect("example.com");
    expect(createProvider).toHaveBeenCalledWith(
      "example.com",
      manifest.version,
    );
  });
});
