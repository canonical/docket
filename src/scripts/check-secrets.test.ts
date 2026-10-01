import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  makeRepository,
  pointings,
  type Repository,
} from "../testing/repository.js";
import readEnvironmentWithoutGit from "./readEnvironmentWithoutGit.js";

/**
 * A stand-in for gitleaks, first on PATH, so the test needs no scanner on
 * the machine. It reads the history of the repository it is given with git,
 * under the environment the self-test hands it, and reports a leak only
 * when the token reached that repository: a commit that landed in the
 * caller's repository instead leaves the fixture clean, and the self-test
 * fails. The real scan is the gate's own: `--self-test` runs it wherever
 * gitleaks is installed.
 */
const standInGitleaks = `#!/bin/sh
for root; do :; done
if git -C "$root" log --all -p | grep -q ghp_; then
  echo "leaks found: 1"
  exit 1
fi
echo "no leaks found"
`;

describe("check-secrets --self-test", () => {
  let repository: Repository;
  let bin: string;
  beforeEach(() => {
    repository = makeRepository();
    bin = mkdtempSync(join(tmpdir(), "gitleaks-stand-in-"));
    writeFileSync(join(bin, "gitleaks"), standInGitleaks, { mode: 0o755 });
  });
  afterEach(() => {
    repository.remove();
    rmSync(bin, { recursive: true, force: true });
  });

  it.each(Object.entries(pointings))(
    "leaves a repository named by %s unchanged, and passes",
    (_, point) => {
      const before = repository.readState();
      const env = readEnvironmentWithoutGit();
      const run = Bun.spawnSync(
        ["bun", "src/scripts/check-secrets.ts", "--self-test"],
        {
          env: {
            ...env,
            PATH: [bin, env.PATH].filter(Boolean).join(delimiter),
            ...point(repository),
          },
        },
      );
      expect(repository.readState()).toBe(before);
      expect(run.stdout.toString()).toContain(
        "the committed token was rejected",
      );
      expect(run.exitCode).toBe(0);
    },
    30_000,
  );
});
