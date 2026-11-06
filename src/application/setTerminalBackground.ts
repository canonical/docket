import { spawnSync } from "node:child_process";

/**
 * Lets the terminal's default background show in this tmux pane while
 * docket is open. tmux otherwise substitutes the window's pane style for
 * the default colour. The pane's existing style is restored on close or
 * process exit, unless another program changed it in the meantime.
 *
 * @note Impure: reads and changes the current tmux pane's style.
 */
export default function setTerminalBackground(): () => void {
  const pane = process.env.TMUX_PANE;
  if (!process.env.TMUX || !pane || !/^%\d+$/.test(pane)) return () => {};

  const run = (...args: string[]) =>
    spawnSync("tmux", ["select-pane", "-t", pane, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  const before = run("-g");
  if (before.status !== 0) return () => {};
  const original = before.stdout.trim();
  if (run("-P", `${original},bg=default`).status !== 0) return () => {};
  const applied = run("-g");
  if (applied.status !== 0) {
    run("-P", original);
    return () => {};
  }
  const expected = applied.stdout.trim();
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  const onSignal = (signal: (typeof signals)[number]) => {
    restore();
    process.kill(process.pid, signal);
  };
  const restore = () => {
    process.removeListener("exit", restore);
    for (const signal of signals) process.removeListener(signal, onSignal);
    const current = run("-g");
    if (current.status === 0 && current.stdout.trim() === expected) {
      run("-P", original);
    }
  };
  process.once("exit", restore);
  for (const signal of signals) process.once(signal, onSignal);
  return restore;
}
