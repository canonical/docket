/**
 * Runs the guarantees `corpus.toml` registers, one entry at a time, each
 * under vitest with the row's file and selector, and judges each run by
 * vitest's own report rather than by its exit code alone: an exit code
 * cannot tell a failed assertion from a file that would not load, or a
 * selector that matched nothing and ran no test at exit 0.
 *
 *   list          every row
 *   run <id>      one entry
 *   tier <tier>   every entry of a tier; exit 0 means the tier is green
 *
 * A tier is green only when its entry marked `expect = "fail"` failed as
 * a test, and every other entry passed. The register is refused whole,
 * before anything runs, when a row is malformed or a test file under this
 * folder belongs to no row, since a file no row names never runs.
 *
 * @note Impure: reads the corpus, starts vitest and writes its reports to
 * a temporary folder.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const corpusRoot = import.meta.dirname;
const repoRoot = resolve(corpusRoot, "..");

const kinds = ["conformance"];
const tiers = ["pr"];
const expectations = ["pass", "fail"];

interface Row {
  readonly id: string;
  readonly kind: string;
  readonly tier: string;
  readonly file: string;
  readonly select: string;
  readonly expect: string;
}

const stop = (message: string): never => {
  console.error(`invoker: ${message}`);
  process.exit(2);
};

/** Every test file under the corpus, relative to it. */
const findTestFiles = (): string[] =>
  [...new Bun.Glob("**/*.test.ts").scanSync({ cwd: corpusRoot })]
    .filter((file) => !file.startsWith("fixtures/"))
    .sort();

/** Reads the register, refusing it whole when any row is malformed. */
const readRegister = (): Row[] => {
  const tables = Bun.TOML.parse(
    readFileSync(join(corpusRoot, "corpus.toml"), "utf8"),
  ) as Record<string, Record<string, unknown>>;
  const rows = Object.entries(tables).map(([id, table]): Row => {
    const read = (key: string, allowed?: readonly string[]) => {
      const value = table[key];
      if (typeof value !== "string" || (allowed && !allowed.includes(value))) {
        stop(
          `row ${id}: \`${key}\` is ${JSON.stringify(value)}${allowed ? `, not one of ${allowed.join(" | ")}` : ""}`,
        );
      }
      return value as string;
    };
    const row = {
      id,
      kind: read("kind", kinds),
      tier: read("tier", tiers),
      file: read("file"),
      select: read("select"),
      expect: read("expect", expectations),
    };
    if (!existsSync(join(corpusRoot, row.file))) {
      stop(`row ${id} names ${row.file}, which does not exist`);
    }
    return row;
  });
  const named = new Set(rows.map(({ file }) => file));
  const orphans = findTestFiles().filter((file) => !named.has(file));
  if (orphans.length > 0) {
    stop(
      `no row names ${orphans.join(", ")}: add a row to corpus.toml, or the file never runs`,
    );
  }
  return rows;
};

interface Verdict {
  readonly ok: boolean;
  readonly line: string;
}

/** Runs one entry and judges it against its row. */
const runEntry = async (row: Row): Promise<Verdict> => {
  const reports = mkdtempSync(join(tmpdir(), "docket-guarantees-"));
  const report = join(reports, "report.json");
  const started = performance.now();
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "x",
        "--bun",
        "vitest",
        "run",
        "--config",
        join(corpusRoot, "vitest.config.ts"),
        row.file,
        "-t",
        row.select,
        "--reporter=default",
        "--reporter=json",
        `--outputFile.json=${report}`,
      ],
      {
        cwd: repoRoot,
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    const code = await child.exited;
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const counts = existsSync(report)
      ? (JSON.parse(readFileSync(report, "utf8")) as Record<string, number>)
      : undefined;
    const passed = counts?.numPassedTests ?? 0;
    const failed = counts?.numFailedTests ?? 0;
    const summary = `${passed} passed, ${failed} failed, expected to ${row.expect} (${seconds}s)`;
    if (passed + failed === 0) {
      const why =
        code === 0
          ? `\`select = "${row.select}"\` matched no test in ${row.file}`
          : `vitest exited ${code} before running ${row.file}; its output above says why`;
      return { ok: false, line: `  BAD   ${row.id}  no test ran: ${why}` };
    }
    const ok =
      row.expect === "fail"
        ? failed > 0 && code !== 0
        : failed === 0 && code === 0;
    return { ok, line: `  ${ok ? "ok " : "BAD"}   ${row.id}  ${summary}` };
  } finally {
    rmSync(reports, { recursive: true, force: true });
  }
};

const register = readRegister();
const [command, argument] = Bun.argv.slice(2);
const findRow = (id: string | undefined) =>
  register.find((row) => row.id === id) ??
  stop(`no entry \`${id}\` in corpus.toml`);

if (command === "list") {
  for (const row of register) {
    console.log(
      `${row.tier.padEnd(4)} ${row.kind.padEnd(12)} ${row.expect.padEnd(5)} ${row.id}`,
    );
  }
} else if (command === "run") {
  const verdict = await runEntry(findRow(argument));
  console.error(verdict.line);
  process.exit(verdict.ok ? 0 : 1);
} else if (command === "tier") {
  const rows = register.filter((row) => row.tier === argument);
  if (rows.length === 0) stop(`tier \`${argument}\` has no entries`);
  if (!rows.some((row) => row.expect === "fail")) {
    stop(
      `tier \`${argument}\` has no entry marked \`expect = "fail"\`, so its green would prove nothing`,
    );
  }
  const verdicts: Verdict[] = [];
  for (const row of rows) verdicts.push(await runEntry(row));
  console.error(`\ntier ${argument}:`);
  for (const { line } of verdicts) console.error(line);
  const green = verdicts.every(({ ok }) => ok);
  console.error(`tier ${argument}: ${green ? "green" : "RED"}`);
  process.exit(green ? 0 : 1);
} else {
  stop(
    `usage: bun ${relative(repoRoot, import.meta.filename)} (list | run <id> | tier <tier>)`,
  );
}
