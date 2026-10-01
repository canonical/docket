/**
 * Refuses production dependencies under a licence that is not permissive.
 *
 * `bun src/scripts/check-licences.ts [root]` reads the installed production
 * dependencies of `root` and exits 1 on any licence outside the allowed list.
 * `--self-test` installs a copyleft dependency into a scratch project and
 * exits 0 only when the check rejects it.
 *
 * Only production dependencies are installed with docket, which ships
 * under MIT. Development tools never ship, so their licences bind nothing
 * here.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const permissive = [
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "ISC",
  "MIT",
  "Unlicense",
];

const checker = join(
  import.meta.dir,
  "../../node_modules/.bin/license-checker-rseidelsohn",
);

function check(root: string, output: "inherit" | "pipe"): [number, string] {
  const run = Bun.spawnSync(
    [
      checker,
      "--start",
      root,
      "--production",
      "--excludePrivatePackages",
      "--onlyAllow",
      permissive.join(";"),
      "--summary",
    ],
    { stdout: output, stderr: output },
  );
  if (output === "inherit" && run.exitCode === 0) {
    console.log("licence check: every production dependency is permissive");
  }
  return [run.exitCode, `${run.stdout ?? ""}${run.stderr ?? ""}`];
}

function write(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

function selfTest(): number {
  const root = mkdtempSync(join(tmpdir(), "licences-fixture-"));
  try {
    write(join(root, "package.json"), {
      name: "example-app",
      version: "1.0.0",
      license: "MIT",
      dependencies: { "example-copyleft": "1.0.0" },
    });
    write(join(root, "node_modules/example-copyleft/package.json"), {
      name: "example-copyleft",
      version: "1.0.0",
      license: "GPL-3.0-only",
    });
    const [exitCode, log] = check(root, "pipe");
    if (exitCode === 0 || !log.includes("example-copyleft")) {
      console.error("licence self-test: the copyleft dependency was accepted");
      console.error(log);
      return 1;
    }
    console.log("licence self-test: the copyleft dependency was rejected");
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
