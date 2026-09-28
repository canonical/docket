/**
 * Saved outputs. A guarantee compares what docket printed with the copy
 * saved under `goldens/`, line by line, so a difference points at the
 * lines that changed. A missing copy fails: saving one is an explicit
 * act, `bun run guarantees:accept <entry>`, whose result is a diff to
 * review like any other.
 *
 * @note Impure: reads, and when accepting writes, `goldens/`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { expect } from "vitest";

const goldens = resolve(import.meta.dirname, "goldens");

/** Requires `actual` to equal the saved output at `goldens/<name>`. */
export default function expectGolden(name: string, actual: string): void {
  const path = resolve(goldens, name);
  // The invoker sets this for `guarantees:accept` alone.
  if (process.env.GUARANTEES_ACCEPT === "1") {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, actual);
    return;
  }
  const shown = relative(resolve(goldens, ".."), path);
  expect(
    existsSync(path),
    `no saved output at ${shown}: save it with bun run guarantees:accept ${name.split("/").at(0)}, then review the diff`,
  ).toBe(true);
  expect(actual.split("\n"), `the output differs from ${shown}`).toEqual(
    readFileSync(path, "utf8").split("\n"),
  );
}
