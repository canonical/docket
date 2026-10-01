/** The file, in the cache folder, that holds every repository's snapshot. */
export const cacheFileName = "snapshots.json";

/**
 * The layout of the cache file. A file written in another layout, by
 * another version of docket, is ignored and fetched again.
 */
export const cacheFormat = 4;

/**
 * How a date is written in the cache file: `{ "$date": "<ISO 8601>" }`.
 * Text from GitHub is always a JSON string, never an object, so no title
 * or comment can pass for a date.
 */
export const dateTag = "$date";

/** The lock, in the cache folder, that the one fetching process holds. */
export const lockName = "fetch.lock";

/**
 * How the fetch lock is held and waited for, in milliseconds. The holder
 * touches the lock every `update`, so it hears within a second when
 * another process took the lock from it; a lock untouched for `stale` is
 * left by a process that died, and is taken over. A process waits for the
 * lock while a live holder keeps it, because the holder is fetching the
 * data the waiter wants, retrying between `minTimeout` and `maxTimeout`
 * apart, and gives up after `maxRetryTime`: longer than a first fetch of
 * several repositories takes, and short enough that an agent's command
 * ends.
 */
export const lockTiming = {
  stale: 10_000,
  update: 1_000,
  retries: {
    forever: true,
    minTimeout: 100,
    maxTimeout: 1_000,
    maxRetryTime: 120_000,
  },
} as const;

/** The file, in the cache folder, that mirrors GitHub's budgets. */
export const budgetFileName = "budget.json";

/**
 * How far ahead of now, in milliseconds, a budget's reset may lie: GitHub
 * resets each budget within the hour, and five minutes more allow for a
 * clock that runs behind. A report that resets later is no report of
 * GitHub's, and is dropped.
 */
export const farthestReset = 3_900_000;

/**
 * How the budget file's own lock, `budget.json.lock`, is held and waited
 * for, in milliseconds. It is held only to read, merge and write that
 * small file. The holder touches it every `update`; a lock untouched for
 * `stale` is left by a process that died, and is taken over. A process
 * waits for it, retrying between `minTimeout` and `maxTimeout` apart, at
 * most `retries` times: about 7 seconds, past `stale`, so a lock a dead
 * process left never makes a keeping give up.
 */
export const budgetLockTiming = {
  stale: 2_000,
  update: 500,
  retries: { retries: 40, minTimeout: 20, maxTimeout: 200 },
} as const;

/**
 * How long, in milliseconds, cached data serves a reader that names no
 * maximum age, so an agent asking in a loop causes at most one refresh
 * every five minutes.
 */
export const defaultMaxAge = 300_000;

/**
 * How often, in milliseconds, a repository is fetched whole rather than
 * since its cursor. No snapshot since a cursor reports a thread that was
 * deleted or moved to another repository; fetching everything drops it.
 */
export const reconcileInterval = 3_600_000;

/**
 * How long, in milliseconds, an open terminal interface waits after one
 * refresh ends before the next begins. A cycle costs about 150 points an
 * hour, 450 at worst: under a tenth of GitHub's hourly 5,000.
 */
export const refreshInterval = 120_000;

/**
 * The share of the hourly budget below which the refresh cycle pauses
 * until the budget resets, leaving the rest to the user's own requests.
 */
export const budgetFloor = 0.2;

/**
 * How long, in milliseconds, after a full refresh starts another is
 * refused: each one fetches every repository whole, which costs points
 * and time.
 */
export const fullRefreshCooldown = 60_000;

/**
 * How long, in milliseconds, a terminal interface waits for a key before
 * it takes the pane as idle: 20 minutes. docket is often a column glanced
 * at without a key, so a pane that nobody touches for that long is left
 * to the slower cycle below.
 */
export const idleAfter = 1_200_000;

/**
 * How long, in milliseconds, an idle pane waits after one refresh ends
 * before the next begins: 30 minutes, only the free checks for changes
 * and the fetch of what changed, with neither the checks refresh nor the
 * whole hourly fetch. A pane left idle for a day sends 48 checks per
 * repository, and spends no points when nothing changed. Stopping
 * altogether would leave the glance hours old with no way to tell; ten
 * minutes would send three times the requests for little more.
 */
export const idleInterval = 1_800_000;
