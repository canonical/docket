import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import fixture from "./fixture.js";
import type { Home, SentRequest } from "./types.js";

const corpusRoot = import.meta.dirname;
const entry = resolve(corpusRoot, "../src/application/main.ts");
const standIn = resolve(corpusRoot, "standIn.ts");

/**
 * Makes a home whose personal file is `personalFile`, and runs docket in
 * it the way a user does, as its own process: `bun` on
 * `src/application/main.ts`, in a temporary home holding the personal
 * file, an empty cache folder and a `gh` that answers with a token no
 * account holds. The stand-in (`standIn.ts`) is preloaded to fix the
 * clock and answer for GitHub from a recording.
 *
 * Nothing here imports docket's sources: a guarantee sees only what a
 * user sees, the output, the exit code and the requests sent to GitHub.
 *
 * @note Impure: writes a temporary folder and starts processes.
 */
export default function makeHome(personalFile: string): Home {
  const root = mkdtempSync(join(tmpdir(), "docket-guarantee-"));
  mkdirSync(join(root, "config", "docket"), { recursive: true });
  writeFileSync(join(root, "config", "docket", "docket.yaml"), personalFile);
  mkdirSync(join(root, "bin"));
  const gh = join(root, "bin", "gh");
  writeFileSync(gh, "#!/bin/sh\necho example-token-guarantees\n");
  chmodSync(gh, 0o755);
  let calls = 0;
  return {
    async call(args, { now, recording, machineZone = "UTC" }) {
      calls += 1;
      const log = join(root, `requests-${calls}.jsonl`);
      writeFileSync(log, "");
      const child = Bun.spawn(
        [process.execPath, "--preload", standIn, entry, ...args],
        {
          cwd: root,
          stdout: "pipe",
          stderr: "pipe",
          // Only what a call needs, so nothing of the machine running the
          // corpus, such as a signed-in gh or a GH_TOKEN, reaches docket.
          env: {
            PATH: `${join(root, "bin")}:${dirname(process.execPath)}:/usr/bin:/bin`,
            HOME: root,
            XDG_CONFIG_HOME: join(root, "config"),
            XDG_CACHE_HOME: join(root, "cache"),
            TZ: machineZone,
            LANG: "C.UTF-8",
            GUARANTEES_NOW: now,
            GUARANTEES_RECORDING: fixture(`${recording}.ts`),
            GUARANTEES_REQUESTS: log,
          },
        },
      );
      const [out, err, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      const requests = readFileSync(log, "utf8")
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as SentRequest);
      return { code, out, err, requests };
    },
    remove() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
