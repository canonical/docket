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
import type { Call, Home, Outcome, SentRequest } from "./types.js";

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
  /** A fresh request log, and the environment a call runs in. */
  const prepare = (
    { now, recording, machineZone = "UTC" }: Call,
    extra: Record<string, string> = {},
  ) => {
    calls += 1;
    const log = join(root, `requests-${calls}.jsonl`);
    writeFileSync(log, "");
    // Only what a call needs, so nothing of the machine running the
    // corpus, such as a signed-in gh or a GH_TOKEN, reaches docket.
    const env = {
      PATH: `${join(root, "bin")}:${dirname(process.execPath)}:/usr/bin:/bin`,
      HOME: root,
      XDG_CONFIG_HOME: join(root, "config"),
      XDG_CACHE_HOME: join(root, "cache"),
      TZ: machineZone,
      LANG: "C.UTF-8",
      GUARANTEES_NOW: now,
      GUARANTEES_RECORDING: recording,
      GUARANTEES_REQUESTS: log,
      // Set by `guarantees:prove` alone, to break the stand-in.
      ...(process.env.GUARANTEES_BREAK
        ? { GUARANTEES_BREAK: process.env.GUARANTEES_BREAK }
        : {}),
      ...extra,
    };
    return { log, env };
  };
  /** What a call printed and how it ended, with the requests it sent. */
  const conclude = (
    log: string,
    code: number,
    out: string,
    err: string,
  ): Outcome => {
    const [ran, ...sent] = readFileSync(log, "utf8")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => JSON.parse(line));
    return {
      code,
      out,
      err,
      requests: sent as SentRequest[],
      machineZone: (ran as { machineZone: string } | undefined)?.machineZone,
    };
  };
  return {
    async call(args, call) {
      const { log, env } = prepare(call);
      const child = Bun.spawn(
        [process.execPath, "--preload", standIn, entry, ...args],
        { cwd: root, stdout: "pipe", stderr: "pipe", env },
      );
      const [out, err, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      return conclude(log, code, out, err);
    },
    async open({ until, keys = [], ready = "", pause = 250, ...call }) {
      const { log, env } = prepare(call, {
        GUARANTEES_UNTIL: until,
        TERM: "xterm-256color",
        ...(keys.length > 0 ? { GUARANTEES_KEYS: "1" } : {}),
      });
      let out = "";
      const { promise: drawn, resolve: showDrawn } =
        Promise.withResolvers<void>();
      const decoder = new TextDecoder();
      const child = Bun.spawn([process.execPath, "--preload", standIn, entry], {
        cwd: root,
        env,
        terminal: {
          cols: 60,
          rows: 24,
          data(_terminal, bytes) {
            out += decoder.decode(bytes);
            // Each run of text is drawn between the terminal's controls.
            // biome-ignore lint/suspicious/noControlCharactersInRegex: these are the controls left out.
            const text = out.replace(/\u001B\[[0-9;?]*[A-Za-z]/g, "");
            if (text.includes(ready)) showDrawn();
          },
        },
      });
      if (keys.length > 0) {
        await drawn;
        for (const [place, key] of keys.entries()) {
          await Bun.sleep(pause);
          if (child.exitCode !== null) {
            throw new Error(
              `docket ended before key ${place + 1} of ${keys.length} was pressed`,
            );
          }
          child.terminal?.write(key);
        }
        // The stand-in's clock moves on only once the last key is pressed.
        child.kill("SIGUSR2");
      }
      const code = await child.exited;
      child.terminal?.close();
      return conclude(log, code, out, "");
    },
    remove() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
