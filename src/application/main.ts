import manifest from "../../package.json" with { type: "json" };
import { createProvider } from "../lib/github/index.js";
import run from "./run.js";

/**
 * Runs docket with the process's arguments, environment and output, and
 * leaves the exit code the answer gives.
 *
 * @note Impure: reads the process's arguments and environment, writes
 * to its output, and sets its exit code.
 */
export default async function main(): Promise<void> {
  process.exitCode = await run({
    args: process.argv.slice(2),
    environment: process.env,
    interactive: process.stdout.isTTY === true,
    write: (text) => process.stdout.write(text),
    writeError: (text) => process.stderr.write(text),
    now: () => new Date(),
    connect: (host) => createProvider(host, manifest.version),
    version: manifest.version,
  });
}

// The executable runs this module as its entry, so the call is the program.
await main();
