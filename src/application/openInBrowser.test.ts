import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import openInBrowser from "./openInBrowser.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

/** A child process that ends as `end` says, once it is listened to. */
function startChild(end: (child: EventEmitter) => void) {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
  vi.mocked(spawn).mockReturnValueOnce(child as never);
  queueMicrotask(() => end(child));
  return child;
}

const url = "https://github.com/example-org/example-repo/pull/12";

afterEach(() => {
  vi.mocked(spawn).mockReset();
});

describe("openInBrowser", () => {
  it("hands the address to xdg-open, detached, silent and not waited on", async () => {
    const child = startChild((opener) => opener.emit("exit", 0));
    await expect(openInBrowser(url)).resolves.toBeUndefined();
    expect(spawn).toHaveBeenCalledWith("xdg-open", [url], {
      detached: true,
      stdio: "ignore",
    });
    expect(child.unref).toHaveBeenCalled();
  });

  it("fails when the opener cannot be run", async () => {
    const missing = Object.assign(new Error("spawn xdg-open ENOENT"), {
      code: "ENOENT",
    });
    startChild((opener) => opener.emit("error", missing));
    await expect(openInBrowser(url)).rejects.toBe(missing);
  });

  it("fails when the opener exits with a failure", async () => {
    startChild((opener) => opener.emit("exit", 3));
    await expect(openInBrowser(url)).rejects.toThrow(
      "xdg-open exited with code 3",
    );
  });
});
