import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import setTerminalBackground from "./setTerminalBackground.js";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  vi.mocked(spawnSync).mockReset();
});

describe("setTerminalBackground", () => {
  it("leaves tmux alone outside a pane", () => {
    delete process.env.TMUX;
    setTerminalBackground()();
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("leaves tmux alone when the pane identifier is invalid", () => {
    process.env.TMUX = "socket,1,0";
    process.env.TMUX_PANE = "invalid";
    setTerminalBackground()();
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2])(
    "leaves or restores the original style when tmux call %i fails",
    (failure) => {
      process.env.TMUX = "socket,1,0";
      process.env.TMUX_PANE = "%42";
      let call = 0;
      vi.mocked(spawnSync).mockImplementation(
        () =>
          ({ status: call++ === failure ? 1 : 0, stdout: "fg=red\n" }) as never,
      );
      setTerminalBackground()();
      expect(spawnSync).toHaveBeenCalledTimes(failure === 2 ? 4 : failure + 1);
      if (failure === 2) {
        expect(vi.mocked(spawnSync).mock.calls[3]?.[1]).toEqual([
          "select-pane",
          "-t",
          "%42",
          "-P",
          "fg=red",
        ]);
      }
    },
  );

  it("restores the pane's original style after using the default background", () => {
    process.env.TMUX = "socket,1,0";
    process.env.TMUX_PANE = "%42";
    const answers = [
      "fg=red,bg=blue",
      "",
      "fg=red,bg=default",
      "fg=red,bg=default",
      "",
    ];
    vi.mocked(spawnSync).mockImplementation(
      () =>
        ({
          status: 0,
          stdout: `${answers.shift()}\n`,
        }) as never,
    );
    const restore = setTerminalBackground();
    restore();
    const args = vi.mocked(spawnSync).mock.calls.map((call) => call[1]);
    expect(args).toEqual([
      ["select-pane", "-t", "%42", "-g"],
      ["select-pane", "-t", "%42", "-P", "fg=red,bg=blue,bg=default"],
      ["select-pane", "-t", "%42", "-g"],
      ["select-pane", "-t", "%42", "-g"],
      ["select-pane", "-t", "%42", "-P", "fg=red,bg=blue"],
    ]);
  });

  it("preserves a pane style changed while docket was open", () => {
    process.env.TMUX = "socket,1,0";
    process.env.TMUX_PANE = "%42";
    const answers = ["default", "", "bg=default", "bg=green"];
    vi.mocked(spawnSync).mockImplementation(
      () =>
        ({
          status: 0,
          stdout: `${answers.shift()}\n`,
        }) as never,
    );
    setTerminalBackground()();
    expect(spawnSync).toHaveBeenCalledTimes(4);
  });

  it("restores the pane before passing a termination signal on", () => {
    process.env.TMUX = "socket,1,0";
    process.env.TMUX_PANE = "%42";
    const answers = ["default", "", "bg=default", "bg=default", ""];
    vi.mocked(spawnSync).mockImplementation(
      () => ({ status: 0, stdout: `${answers.shift()}\n` }) as never,
    );
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    setTerminalBackground();
    const handler = process.listeners("SIGTERM").at(-1);
    handler?.("SIGTERM");
    expect(vi.mocked(spawnSync).mock.calls.at(-1)?.[1]).toEqual([
      "select-pane",
      "-t",
      "%42",
      "-P",
      "default",
    ]);
    expect(kill).toHaveBeenCalledWith(process.pid, "SIGTERM");
    kill.mockRestore();
  });
});
