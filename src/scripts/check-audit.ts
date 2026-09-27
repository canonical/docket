/**
 * Refuses dependencies with a published security advisory.
 *
 * `bun src/scripts/check-audit.ts [root]` runs `bun audit` against the
 * lockfile in `root` and exits 1 on any advisory. `--self-test` audits a
 * lockfile that pins a dependency with known advisories, and exits 0 only when
 * the audit rejects it. Both need the network, which the advisory database
 * lives on.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function check(root: string, output: "inherit" | "pipe"): [number, string] {
  const run = Bun.spawnSync(["bun", "audit"], {
    cwd: root,
    stdout: output,
    stderr: output,
  });
  return [run.exitCode, `${run.stdout ?? ""}${run.stderr ?? ""}`];
}

// minimist 1.2.0 carries prototype-pollution advisories fixed in 1.2.6.
const manifest = {
  name: "example-app",
  version: "1.0.0",
  dependencies: { minimist: "1.2.0" },
};
const lockfile = {
  lockfileVersion: 1,
  workspaces: {
    "": { name: "example-app", dependencies: manifest.dependencies },
  },
  packages: { minimist: ["minimist@1.2.0", "", {}, ""] },
};

function selfTest(): number {
  const root = mkdtempSync(join(tmpdir(), "audit-fixture-"));
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
    writeFileSync(join(root, "bun.lock"), JSON.stringify(lockfile));
    const [exitCode, log] = check(root, "pipe");
    if (exitCode === 0 || !log.includes("minimist")) {
      console.error("audit self-test: the vulnerable dependency was accepted");
      console.error(log);
      return 1;
    }
    console.log("audit self-test: the vulnerable dependency was rejected");
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
