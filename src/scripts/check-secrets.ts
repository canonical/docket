/**
 * Scans the repository for committed or pending secrets with gitleaks.
 *
 * `bun src/scripts/check-secrets.ts [root]` scans every commit, then the
 * staged and the unstaged changes, and exits 1 when gitleaks reports a leak.
 * `--self-test` commits a generated token to a scratch repository and exits 0
 * only when the scan rejects it.
 *
 * gitleaks runs from PATH when it is installed, and through nix otherwise.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function gitleaks(): string[] {
  if (Bun.which("gitleaks")) return ["gitleaks"];
  if (Bun.which("nix")) return ["nix", "run", "nixpkgs#gitleaks", "--"];
  throw new Error(
    "gitleaks is not installed: install it, or install nix to fetch it",
  );
}

const scans = [
  ["git", "--redact", "--no-banner"],
  ["git", "--redact", "--no-banner", "--staged"],
  ["git", "--redact", "--no-banner", "--pre-commit"],
];

function check(root: string, output: "inherit" | "pipe"): [number, string] {
  let exitCode = 0;
  let log = "";
  for (const scan of scans) {
    const run = Bun.spawnSync([...gitleaks(), ...scan, root], {
      stdout: output,
      stderr: output,
    });
    log += `${run.stdout ?? ""}${run.stderr ?? ""}`;
    exitCode = Math.max(exitCode, run.exitCode);
  }
  return [exitCode, log];
}

function generatedToken(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(36));
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  // Built at run time so that no token-shaped string is ever committed.
  return `ghp_${body.join("")}`;
}

function selfTest(): number {
  const root = mkdtempSync(join(tmpdir(), "secrets-fixture-"));
  try {
    const git = (...args: string[]) =>
      Bun.spawnSync(
        [
          "git",
          "-c",
          "user.name=alice",
          "-c",
          "user.email=alice@example.com",
          "-c",
          "commit.gpgsign=false",
          ...args,
        ],
        { cwd: root },
      );
    git("init", "-q");
    writeFileSync(join(root, "settings.env"), `TOKEN=${generatedToken()}\n`);
    git("add", "settings.env");
    git("commit", "-q", "-m", "settings");
    const [exitCode, log] = check(root, "pipe");
    if (exitCode === 0 || !log.includes("leaks found")) {
      console.error("secrets self-test: the committed token was not rejected");
      console.error(log);
      return 1;
    }
    console.log("secrets self-test: the committed token was rejected");
    return 0;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const [argument] = process.argv.slice(2);
process.exitCode =
  argument === "--self-test"
    ? selfTest()
    : check(argument ?? process.cwd(), "inherit")[0];
