import { spawn } from "node:child_process";

/**
 * Opens `url` in the user's browser with `xdg-open`, the desktop's own
 * opener on Linux, the one system docket is built for. The opener runs
 * as a child of its own, detached and with no input or output, so a
 * browser it starts never writes over the terminal interface and outlives
 * docket, and docket never waits for it to close.
 *
 * @note Impure: starts a process.
 * @throws Error When the opener cannot be run, or exits with a failure,
 * such as when no browser is set.
 */
export default function openInBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`xdg-open exited with code ${code}`)),
    );
    child.unref();
  });
}
