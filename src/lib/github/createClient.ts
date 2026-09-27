import { Octokit } from "@octokit/core";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import Bottleneck from "bottleneck";
import type { Budget } from "../provider/index.js";
import { apiUrl } from "./constants.js";
import describeFailure from "./describeFailure.js";
import type { Client, RestResponse } from "./types.js";

const GitHub = Octokit.plugin(throttling, retry);

/** The rate figures every GraphQL document of the adapter asks for. */
interface RateLimitNode {
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: string;
}

/**
 * Retries a request refused for a rate limit once, after the wait GitHub
 * names, then gives up so the caller can say when to try again.
 */
const retryOnce = (
  _after: number,
  _options: unknown,
  _octokit: unknown,
  retryCount: number,
): boolean => retryCount < 1;

/**
 * Builds the client every operation of the adapter goes through: Octokit
 * with its throttling and retry plugins, so docket writes no throttling,
 * back-off or retry of its own.
 *
 * @param version docket's version, sent in the User-Agent GitHub requires.
 */
export default function createClient(token: string, version: string): Client {
  const throttle = {
    // GitHub asks clients to send one request at a time. The plugin
    // already runs GraphQL requests one at a time through its write
    // queue, a second apart; this global queue, which every request
    // passes, holds REST reads to one at a time as well.
    global: new Bottleneck.Group({ maxConcurrent: 1 }),
    onRateLimit: retryOnce,
    onSecondaryRateLimit: retryOnce,
  };
  const octokit = new GitHub({
    auth: token,
    baseUrl: apiUrl,
    userAgent: `docket/${version}`,
    throttle,
    // Rate limits, answered 403 or 429, belong to the throttling plugin
    // alone, which waits as long as GitHub asks and retries at most once.
    // The retry plugin would otherwise send a 429 three more times, a few
    // seconds apart, whatever wait GitHub named.
    retry: { doNotRetry: [400, 401, 403, 404, 410, 422, 429, 451] },
  });
  let budget: Budget | undefined;
  return {
    async query<T>(document: string, variables: Record<string, unknown>) {
      try {
        const data = await octokit.graphql<T & { rateLimit?: RateLimitNode }>(
          document,
          variables,
        );
        if (data.rateLimit) {
          const { limit, remaining, resetAt } = data.rateLimit;
          budget = { limit, remaining, resetAt: new Date(resetAt) };
        }
        return data;
      } catch (error) {
        throw describeFailure(error);
      }
    },
    async request<T>(route: string, parameters: Record<string, unknown> = {}) {
      try {
        const { status, data, headers } = await octokit.request(
          route,
          parameters,
        );
        return { status, data, headers } as RestResponse<T>;
      } catch (error) {
        const { status, response } = error as {
          status?: number;
          response?: RestResponse<T>;
        };
        if (status === 304 && response) {
          return { status, data: response.data, headers: response.headers };
        }
        throw describeFailure(error);
      }
    },
    lastBudget: () => budget,
  };
}
