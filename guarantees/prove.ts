/**
 * Breaks the corpus on purpose and requires it to notice: it moves one
 * saved output aside, runs `text-output`, and succeeds only when that
 * entry failed an assertion for the missing copy. A golden entry that
 * passed without its saved output would be recording on absence, and
 * whatever docket printed next would pass as the saved output.
 *
 * The invoker's verdict is read from its own report line, not from how
 * it exited: a register that does not parse exits non-zero too, without
 * the entry ever running. The saved output is put back on every path.
 *
 * @note Impure: moves a file in `goldens/` and back, and starts the
 * invoker.
 */
import { renameSync } from "node:fs";
import { join } from "node:path";

const corpusRoot = import.meta.dirname;
const golden = join(corpusRoot, "goldens/text-output/owed.plain.txt");
const aside = `${golden}.aside`;

renameSync(golden, aside);
let proved = false;
try {
  const child = Bun.spawn(
    [process.execPath, join(corpusRoot, "invoker.ts"), "run", "text-output"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [out, err] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  process.stderr.write(out + err);
  const reported = /^\s*BAD\s+text-output\s+\d+ passed, (\d+) failed/m.exec(
    err,
  );
  proved =
    Number(reported?.at(1) ?? 0) > 0 &&
    `${out}${err}`.includes(
      "no saved output at goldens/text-output/owed.plain.txt",
    );
} finally {
  renameSync(aside, golden);
}

if (!proved) {
  console.error(
    "\nprove: FAILED. text-output did not fail for its missing saved output: either it passed without it, or it never ran, and the output above says which.",
  );
  process.exit(1);
}
console.error(
  "\nprove: text-output failed for its missing saved output, as it must.",
);
