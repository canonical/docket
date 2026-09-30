/**
 * A docket process that ends while it writes the cache file, after the
 * new contents are written beside the file and before they take its
 * place, as docket ends when the terminal interface closes during a
 * write. Started by the cache file's tests to prove the file is never
 * left half written.
 *
 * Usage: bun src/testing/writeQuitter.ts <cache file>
 */
import { dehydrate, QueryClient } from "@tanstack/query-core";
import writeCacheFile from "../lib/cache/writeCacheFile.js";

const [file = ""] = process.argv.slice(2);

await writeCacheFile(
  file,
  { state: dehydrate(new QueryClient()), fullRefreshAt: undefined, budget: {} },
  () => process.exit(0),
);
