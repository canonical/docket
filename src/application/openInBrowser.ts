import { spawn } from "node:child_process";

/**
 * Opens `url` in the user's browser with `xdg-open`, the desktop's own
 * opener on Linux, the one system docket is built for. The opener runs
 * as a child of its own, detached and with no input or output, so a
 * browser it starts never writes over the terminal interface and outlives
 * docket, and docket never waits for it to close.
 *
 * Only a GitHub page over `https:` is handed on. `xdg-open` reads an
 * argument that begins with `-` as one of its options, and passes any
 * other scheme, such as `file:` or `vscode:`, to whatever program claims
 * it, so an address from the cache or the API opens nothing else.
 *
 * @note Impure: starts a process.
 * @throws Error When `url` is not a GitHub page, when the opener cannot
 * be run, or when it exits with a failure, such as when no browser is set.
 */
export default function openInBrowser(url: string): Promise<void> {
  const address = URL.canParse(url) ? new URL(url) : undefined;
  if (address?.protocol !== "https:" || address.host !== "github.com") {
    return Promise.reject(new Error(`not a GitHub address: ${url}`));
  }
  return new Promise((resolve, reject) => {
    const child = spawn("xdg-open", [address.href], {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`xdg-open exited with code ${code}`)),
    );
    child.unref();
  });
}
