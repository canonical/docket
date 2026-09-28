/**
 * GitHub at the network boundary: a stand-in for `fetch` that answers
 * from recorded responses and keeps every request it received, and
 * builders for GitHub's response shapes with neutral names.
 */
import { vi } from "vitest";

/** A token no real account holds, to prove it never leaks. */
export const token = "example-token-7f3a9c";

/** A request the stand-in received. */
export interface Sent {
  readonly method: string;
  readonly url: URL;
  readonly headers: Headers;
  /** The JSON body, when there is one. */
  readonly body: Record<string, unknown> | undefined;
  /** When it was received, in milliseconds on the clock the test runs. */
  readonly at: number;
}

/** A recorded answer: a body, or a status with a body and headers. */
export interface Answer {
  readonly status?: number;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

type Responder = Answer | ((sent: Sent) => Answer);

/**
 * A stand-in for GitHub. `graphql` queues answers for a GraphQL document
 * by its operation name, and `rest` for a method and path; each answer is
 * used once, in order. A request with no answer left gets a 404 naming
 * it, which is never retried.
 */
export function fakeGitHub() {
  const queues = new Map<string, Responder[]>();
  const sent: Sent[] = [];
  const add = (key: string, answers: Responder[]) => {
    queues.set(key, [...(queues.get(key) ?? []), ...answers]);
  };
  const fetch = async (
    input: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> => {
    const url = new URL(String(input));
    const text = typeof init.body === "string" ? init.body : undefined;
    const request: Sent = {
      method: init.method ?? "GET",
      url,
      headers: new Headers(init.headers),
      body: text ? JSON.parse(text) : undefined,
      at: Date.now(),
    };
    sent.push(request);
    const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(
      String(request.body?.query ?? ""),
    )?.[1];
    const key =
      url.pathname === "/graphql"
        ? `graphql ${operation}`
        : `${request.method} ${url.pathname}`;
    const responder = queues.get(key)?.shift();
    const answer =
      typeof responder === "function" ? responder(request) : responder;
    if (!answer) {
      return Response.json(
        { message: `no answer for ${key}` },
        { status: 404 },
      );
    }
    const status = answer.status ?? 200;
    const body =
      answer.body === undefined || status === 304
        ? null
        : JSON.stringify(answer.body);
    return new Response(body, {
      status,
      headers: { "content-type": "application/json", ...answer.headers },
    });
  };
  return {
    fetch: vi.fn(fetch),
    sent,
    /** Queues answers to the GraphQL operation `name`. */
    graphql(name: string, ...answers: Responder[]) {
      add(`graphql ${name}`, answers);
    },
    /** Queues answers to `method path`, such as `GET /repos/o/r/activity`. */
    rest(route: string, ...answers: Responder[]) {
      add(route, answers);
    },
  };
}

/**
 * Settles `promise` while advancing fake timers, so the throttling
 * plugin's one-second spacing and retry waits pass at once.
 */
export async function settle<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  promise.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    },
  );
  while (!done) await vi.advanceTimersByTimeAsync(1000);
  return promise;
}

/** The rate figures every GraphQL answer carries. */
export const rateLimit = {
  limit: 5000,
  remaining: 4990,
  resetAt: "2026-09-28T11:00:00Z",
};

/** A GraphQL answer with `repository` holding `fields`. */
export const repository = (fields: Record<string, unknown>) => ({
  body: { data: { rateLimit, repository: fields } },
});

/** A GraphQL list of nodes; `next` names the following page. */
export const page = (nodes: unknown[], next: string | null = null) => ({
  pageInfo: { hasNextPage: next !== null, endCursor: next },
  nodes,
});

/** A person's account as GraphQL gives it. */
export const user = (login: string) => ({ login, __typename: "User" });

/** A bot's account as GraphQL gives it; its login carries no suffix. */
export const bot = (login: string) => ({ login, __typename: "Bot" });

/** An account as REST gives it. */
export const restUser = (login: string, type = "User") => ({ login, type });

/** A comment by `login`, a member of the organisation, as GraphQL gives it. */
export const comment = (
  login: string,
  createdAt: string,
  association = "MEMBER",
) => ({ author: user(login), authorAssociation: association, createdAt });

/**
 * An open issue in example-org/example-repo, as the snapshot query gives
 * it: opened by dave, from outside the organisation.
 */
export const issueNode = (fields: Record<string, unknown> = {}) => ({
  number: 1,
  url: "https://github.com/example-org/example-repo/issues/1",
  title: "Example issue",
  createdAt: "2026-09-22T08:00:00Z",
  updatedAt: "2026-09-22T08:00:00Z",
  state: "OPEN",
  author: user("dave"),
  authorAssociation: "NONE",
  assignees: { nodes: [] },
  labels: { nodes: [] },
  comments: { nodes: [] },
  ...fields,
});

/**
 * An open pull request by alice from a branch of example-org/example-repo,
 * as the snapshot query gives it, with no review, request or check.
 */
export const pullNode = (fields: Record<string, unknown> = {}) => ({
  ...issueNode({
    number: 2,
    url: "https://github.com/example-org/example-repo/pull/2",
    title: "Example pull request",
    author: user("alice"),
    authorAssociation: "MEMBER",
  }),
  isDraft: false,
  headRefName: "feat/example",
  isCrossRepository: false,
  latestReviews: { nodes: [] },
  requested: { nodes: [] },
  withdrawn: { nodes: [] },
  commits: {
    nodes: [
      {
        commit: {
          committedDate: "2026-09-22T07:55:00Z",
          author: { user: { login: "alice" } },
          statusCheckRollup: null,
        },
      },
    ],
  },
  stackEntry: null,
  ...fields,
});

/** An open discussion by dave, as the snapshot query gives it. */
export const discussionNode = (fields: Record<string, unknown> = {}) => ({
  number: 3,
  url: "https://github.com/example-org/example-repo/discussions/3",
  title: "Example discussion",
  createdAt: "2026-09-22T08:00:00Z",
  updatedAt: "2026-09-22T08:00:00Z",
  closed: false,
  author: user("dave"),
  authorAssociation: "NONE",
  labels: { nodes: [] },
  comments: { nodes: [] },
  ...fields,
});

/** An entry of the repository activity feed, as REST gives it. */
export const feedEntry = (fields: Record<string, unknown> = {}) => ({
  id: 1,
  before: "0000001",
  after: "0000002",
  ref: "refs/heads/feat/example",
  timestamp: "2026-09-22T09:00:00Z",
  activity_type: "push",
  actor: restUser("alice"),
  ...fields,
});
