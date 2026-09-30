/**
 * A provider at the port boundary, for the cache's tests and for the
 * processes they start. It imports nothing from vitest, so a plain Bun
 * process can run it too.
 */
import type {
  Capability,
  Provider,
  ProviderError,
  ProviderErrorCode,
} from "../lib/provider/index.js";

/** Every optional fact a provider may declare. */
export const everyCapability: ReadonlySet<Capability> = new Set<Capability>([
  "discussions",
  "stacks",
  "teamReviews",
  "checks",
  "botAccounts",
  "pushes",
  "changeProbe",
]);

/** A full hourly budget that resets at 11:00 UTC on 28 September 2026. */
export const fullBudget = {
  limit: 5000,
  remaining: 5000,
  resetAt: new Date("2026-09-28T11:00:00Z"),
};

/**
 * A provider that finds no thread and sees a change at every check, with
 * a full budget and every capability. `overrides` replaces any operation.
 * An operation the cache never calls fails, naming itself.
 */
export function fakeProvider(overrides: Partial<Provider> = {}): Provider {
  const unused = (name: string) => () =>
    Promise.reject(new Error(`${name} is not part of this fake`));
  return {
    snapshot: async () => ({ threads: [], cursor: null }),
    refreshVolatile: async () => [],
    events: unused("events"),
    threadDetail: unused("threadDetail"),
    threadDetails: unused("threadDetails"),
    assignableUsers: unused("assignableUsers"),
    reviewCandidates: unused("reviewCandidates"),
    readAssignees: unused("readAssignees"),
    setAssignees: unused("setAssignees"),
    setReviewers: unused("setReviewers"),
    teamMembers: unused("teamMembers"),
    probe: async () => ({ changed: true, tag: undefined }),
    readFile: async () => undefined,
    budget: () => ({ graphql: fullBudget }),
    viewer: unused("viewer"),
    capabilities: () => everyCapability,
    ...overrides,
  };
}

/** An error as a provider throws it, with a named code and a recovery. */
export function providerError(code: ProviderErrorCode): ProviderError {
  return Object.assign(new Error(`The provider failed with ${code}.`), {
    code,
    recovery: "try again",
  });
}
