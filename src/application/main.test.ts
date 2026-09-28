import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../package.json" with { type: "json" };
import { recordedNow, recordedSettings } from "../testing/recorded.js";
import type { Context, TerminalView } from "./types.js";

const run = vi.fn(async (_context: Context) => 3);
vi.mock("./run.js", () => ({ default: run }));
const createProvider = vi.fn(async () => ({}));
vi.mock("../lib/github/index.js", () => ({ createProvider }));
const openTerminal = vi.fn(async () => 0);
vi.mock("./openTerminal.js", () => ({ default: openTerminal }));

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("main", () => {
  it("answers the process's arguments, exits with the answer's code, and ends the process once the interface closes", async () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const writeError = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    await import("./main.js");
    expect(process.exitCode).toBe(3);
    // A text answer leaves the process to end once its output is written.
    expect(exit).not.toHaveBeenCalled();
    const [context] = run.mock.calls.at(0) ?? [];
    if (!context) throw new Error("run was called");
    expect(context).toMatchObject({
      args: process.argv.slice(2),
      environment: process.env,
      interactive: process.stdout.isTTY === true,
      interactiveInput: process.stdin.isTTY === true,
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
    const view: TerminalView = {
      mode: "owed",
      owedGrouping: "none",
      now: () => recordedNow,
      settings: recordedSettings,
      watched: [],
      source: {
        problem: {
          code: "GH_NOT_INSTALLED",
          message: "docket needs the GitHub CLI (gh).",
          recovery: "install it",
        },
      },
    };
    await context.openTerminal(view);
    expect(openTerminal).toHaveBeenCalledWith(view);
    // Closing the interface ends the process at once, whatever requests
    // are still waiting on GitHub.
    expect(exit).toHaveBeenCalledWith(0);
  });
});
