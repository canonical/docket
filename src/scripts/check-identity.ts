/**
 * Refuses personal, machine and planning references in the repository's files.
 *
 * `bun src/scripts/check-identity.ts [root]` scans every file git tracks or
 * would track under `root` (the working directory by default) and exits 1 on
 * a finding. `--self-test` builds a fixture that breaks every rule and exits 0
 * only when the scan rejects each break and accepts each allowance.
 *
 * This file holds the refused words themselves, so it is the one file the
 * scan skips.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type Rule = {
  name: string;
  pattern: RegExp;
  /** Which files the rule reads; every file when absent. */
  appliesTo?: (file: string) => boolean;
  /** A line the rule lets through in a given file. */
  allows?: (file: string, line: string) => boolean;
};

const self = "src/scripts/check-identity.ts";

// The lockfile is written by the package manager from registry data, so only
// a machine path can leak into it, through a local dependency.
const authored = (file: string) => file !== "bun.lock";

const fixture = (file: string) =>
  file.startsWith("src/testing/") ||
  file.startsWith("guarantees/") ||
  /\.(test|stories)\.tsx?$/.test(file);

const rules: Rule[] = [
  { name: "home path", pattern: /\/(home|Users)\// },
  {
    name: "personal login",
    pattern: /\b(advl|potentialwook|stavropouloskonstantinoss)\b/i,
    appliesTo: authored,
    // Attribution is the one place a login belongs: the licence and the
    // manifest's author field.
    allows: (file, line) =>
      file === "LICENSE" ||
      (file === "package.json" && /^\s*"author"\s*:/.test(line)),
  },
  {
    name: "real repository in a fixture",
    pattern: /(?<![@\w])canonical\/[\w.-]+/i,
    appliesTo: fixture,
  },
  {
    name: "house artifact name",
    pattern: /\bsem\b|\.claude\b|\bpragma-adrs\b/i,
    appliesTo: authored,
  },
  {
    name: "history vocabulary",
    pattern: /\b(rewrit\w*|legacy|reimplement\w*|parity|twins?|ported)\b/i,
    appliesTo: authored,
  },
  {
    name: "tracker or decision identifier",
    pattern: /\bDK\.[A-Z]+\.[0-9]|\bM\.[01][0-9]\b|\bAP-[0-9]/,
    appliesTo: authored,
  },
];

type Finding = { file: string; line: number; rule: string; text: string };

function listFiles(root: string): string[] {
  const listing = Bun.spawnSync(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root },
  );
  if (listing.exitCode !== 0) {
    throw new Error(`git ls-files failed in ${root}: ${listing.stderr}`);
  }
  return listing.stdout.toString().split("\0").filter(Boolean);
}

async function scan(root: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const file of listFiles(root)) {
    if (file === self) continue;
    const handle = Bun.file(join(root, file));
    if (!(await handle.exists())) continue;
    const lines = (await handle.text()).split("\n");
    for (const rule of rules) {
      if (rule.appliesTo && !rule.appliesTo(file)) continue;
      lines.forEach((line, index) => {
        const match = rule.pattern.exec(line);
        if (!match || rule.allows?.(file, line)) return;
        findings.push({
          file,
          line: index + 1,
          rule: rule.name,
          text: match[0],
        });
      });
    }
  }
  return findings;
}

async function check(root: string): Promise<number> {
  const findings = await scan(root);
  for (const { file, line, rule, text } of findings) {
    console.error(`${file}:${line}: ${rule}: "${text}"`);
  }
  if (findings.length > 0) {
    console.error(`identity check: ${findings.length} finding(s)`);
    return 1;
  }
  console.log("identity check: no findings");
  return 0;
}

/** Each file must be rejected, for the rule named beside it. */
const breaks: Record<string, [string, string]> = {
  "notes/home.md": ["home path", "cache in /home/someone/.cache"],
  "notes/mac.md": ["home path", "cache in /Users/someone/Library"],
  "notes/login.md": ["personal login", "asked potentialwook"],
  "package.json": ["personal login", '{ "name": "advl" }'],
  "src/testing/repos.ts": ["real repository in a fixture", "canonical/pragma"],
  "notes/house.md": ["house artifact name", "see pragma-adrs"],
  "notes/tool.md": ["house artifact name", "run sem check"],
  "notes/agent.md": ["house artifact name", "set in .claude/settings"],
  "notes/history.md": ["history vocabulary", "ported from the old tool"],
  "notes/rewrite.md": ["history vocabulary", "a rewrite of it"],
  "notes/tracker.md": ["tracker or decision identifier", "per DK.SCOPE.1"],
  "notes/adr.md": ["tracker or decision identifier", "see M.04"],
};

/** Each file must be accepted: the allowances and the rules' scopes. */
const allowed: Record<string, string> = {
  LICENSE: "Copyright (c) 2026 advl",
  "src/testing/people.ts": 'export default ["alice", "bob"];',
  "src/lib/owed/rows.ts": 'const example = "example-org/example-repo";',
  "docs/packages.md": "uses @canonical/biome-config",
  "bun.lock": '"legacy-package": ["legacy-package@1.0.0"]',
};

async function selfTest(): Promise<number> {
  const root = mkdtempSync(join(tmpdir(), "identity-fixture-"));
  try {
    Bun.spawnSync(["git", "init", "-q"], { cwd: root });
    const files = { ...allowed };
    for (const [file, [, text]] of Object.entries(breaks)) files[file] = text;
    files["package.json"] =
      `{\n  "author": "advl",\n  ${breaks["package.json"]?.[1]}\n}\n`;
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), `${text}\n`);
    }
    const findings = await scan(root);
    const failures: string[] = [];
    for (const [file, [rule]] of Object.entries(breaks)) {
      if (!findings.some((f) => f.file === file && f.rule === rule)) {
        failures.push(`${file} was not rejected for "${rule}"`);
      }
    }
    const authorLine = findings.find(
      (f) => f.file === "package.json" && f.line === 2,
    );
    if (authorLine) failures.push("package.json's author field was rejected");
    for (const file of Object.keys(allowed)) {
      if (findings.some((f) => f.file === file)) {
        failures.push(`${file} was rejected but is allowed`);
      }
    }
    if (failures.length > 0) {
      for (const failure of failures) console.error(failure);
      return 1;
    }
    console.log(
      `identity self-test: ${Object.keys(breaks).length} breaks rejected, ${Object.keys(allowed).length + 1} allowances accepted`,
    );
    return 0;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const [argument] = process.argv.slice(2);
process.exitCode =
  argument === "--self-test"
    ? await selfTest()
    : await check(argument ?? process.cwd());
