import identifyFile from "./identifyFile.js";

/** What holding a lock gave: whether it was lost, and the task's outcome. */
export interface Held<T> {
  /** True when another process took the lock over while the task ran. */
  readonly lost: boolean;
  readonly outcome: { readonly value: T } | { readonly error: unknown };
}

/**
 * Holds a lock that `take` takes, at `lockfilePath`, while `task` runs, and
 * lets it go as every docket lock is let go. `task` hears `isOwn`, which
 * says whether the lock is still this process's, so it can write nothing
 * once another process took the lock over. A lock that cannot be looked
 * at is taken to be still this process's: only a lock gone, or another in
 * its place, is a takeover.
 *
 * The library hears that its lock was taken only when its next touch of
 * the lock comes due, which a process that stalled runs late, and it gives
 * up whatever lock it finds; the lock in the folder says at once whether
 * it is still this one. Until that touch, the library still counts a lost
 * lock as this process's, and removes it when the process exits: the lock
 * of the process that took it over. So the library is let forget the lock
 * first, which it does within one touch, since the lock it touches is gone
 * or another's. When the other process takes the lock between the
 * library's check of the lock and its touch, the library touches the
 * other's lock and keeps it as its own for good, keeping it fresh so that
 * no process can take it. The wait for that ends after `stale`, and the
 * lock is then let go: by then the other process, at its own touch, found
 * a time it did not set and dropped its claim, so the lock is this
 * process's alone. A lock taken over is otherwise never let go.
 *
 * @note Impure: takes, looks at and lets go of the lock in the filesystem.
 * @param take Takes the lock, telling its argument when the library hears
 * that another process took it over, and gives back how to let it go.
 */
export default async function holdLock<T>(
  take: (onCompromised: () => void) => Promise<() => Promise<void>>,
  lockfilePath: string,
  stale: number,
  task: (isOwn: () => Promise<boolean>) => Promise<T>,
): Promise<Held<T>> {
  const forgotten = Promise.withResolvers<void>();
  let lost = false;
  const release = await take(() => {
    lost = true;
    forgotten.resolve();
  });
  // A first look that fails leaves nothing to compare, and the lock counts
  // as still held; a lock gone at the first look was taken over.
  const unseen = Symbol("unseen");
  const held = await identifyFile(lockfilePath).catch(() => unseen);
  /**
   * Whether the lock is still the one this process took: the library has
   * not said it was taken over, and the lock in the folder is the same.
   */
  const isOwn = async () =>
    !lost &&
    (held === unseen ||
      (await identifyFile(lockfilePath).catch(() => held)) === held);
  let outcome: Held<T>["outcome"];
  try {
    outcome = { value: await task(isOwn) };
  } catch (error) {
    outcome = { error };
  }
  if (!(await isOwn())) lost = true;
  if (lost) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const kept = await Promise.race([
      forgotten.promise.then(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), stale);
      }),
    ]);
    clearTimeout(timer);
    if (kept) await release();
  } else await release();
  return { lost, outcome };
}
