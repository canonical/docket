import CacheError from "./CacheError.js";

/**
 * Names a failure to use the cache folder: a filesystem error, which
 * carries the call that failed and the path it failed on, such as a
 * cache home that is a file (`ENOTDIR`), a folder docket may not write
 * (`EACCES`) or a full disk (`ENOSPC`), becomes `CACHE_UNUSABLE`, naming
 * the cause. Any other failure is given back as it is.
 *
 * @param directory The cache folder, which the recovery names.
 */
export default function classifyFolderFailure(
  error: unknown,
  directory: string,
): unknown {
  const { syscall, path } = (error ?? {}) as {
    syscall?: unknown;
    path?: unknown;
  };
  if (
    !(error instanceof Error) ||
    typeof syscall !== "string" ||
    typeof path !== "string"
  ) {
    return error;
  }
  return new CacheError(
    "CACHE_UNUSABLE",
    `docket cannot use its cache folder ${directory}: ${error.message}.`,
    `make ${directory} a folder you can write to, or set XDG_CACHE_HOME to one`,
  );
}
