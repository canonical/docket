/**
 * Loaded by Bun before docket's entry (`bun --preload`), this stands in
 * for the two things outside docket a guarantee has to fix: the clock and
 * GitHub. docket's own code is untouched; it reads the time and calls
 * `fetch` exactly as it does for a user.
 *
 * - The clock: `new Date()` with no argument gives `GUARANTEES_NOW`.
 *   `Date.now()` keeps running, because the request libraries space and
 *   time out requests with it, and a clock that never moves would never
 *   let one of their waits end.
 * - GitHub: `fetch` answers from the recording module `GUARANTEES_RECORDING`
 *   names, and appends each request it received to the file
 *   `GUARANTEES_REQUESTS` names, one JSON line each. An answer arrives a
 *   few milliseconds after its request, so two requests sent together
 *   overlap and the log shows it.
 *
 * A request the recording holds no answer for gets a 404 naming it, which
 * docket reports as a failure, so a recording that falls behind docket
 * fails loudly rather than answering with nothing.
 *
 * @note Impure: replaces two globals and appends to a file.
 */
import { appendFileSync } from "node:fs";
import type { Recording, SentRequest } from "./types.js";

const { GUARANTEES_NOW, GUARANTEES_RECORDING, GUARANTEES_REQUESTS } =
  process.env;
if (!GUARANTEES_NOW || !GUARANTEES_RECORDING || !GUARANTEES_REQUESTS) {
  throw new Error(
    "the stand-in needs GUARANTEES_NOW, GUARANTEES_RECORDING and GUARANTEES_REQUESTS",
  );
}
const fixed = new Date(GUARANTEES_NOW).getTime();
const recording: Recording = (await import(GUARANTEES_RECORDING)).default;
const log = GUARANTEES_REQUESTS;

const RealDate = Date;
class FixedDate extends RealDate {
  // biome-ignore lint/suspicious/noExplicitAny: Date's constructor takes several shapes, passed on whole.
  constructor(...args: any[]) {
    if (args.length === 0) super(fixed);
    else super(...(args as [string]));
  }
}
globalThis.Date = FixedDate as DateConstructor;

const recordedRateLimit = {
  limit: 5000,
  remaining: 4900,
  resetAt: new RealDate(fixed + 3_600_000).toISOString(),
};

let inFlight = 0;
const answerDelay = 5;

/** The key an answer is recorded under, as `Recording` describes it. */
const findKey = (method: string, url: URL, body: Record<string, unknown>) => {
  if (url.pathname !== "/graphql") return `${method} ${url.pathname}`;
  const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(
    String(body.query ?? ""),
  )?.[1];
  const variables = (body.variables ?? {}) as Record<string, unknown>;
  const number = variables.number === undefined ? "" : `#${variables.number}`;
  return `${operation} ${variables.owner}/${variables.name}${number}`;
};

globalThis.fetch = (async (
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> => {
  inFlight += 1;
  const sent: SentRequest = {
    method: init.method ?? "GET",
    url: String(input),
    body: typeof init.body === "string" ? JSON.parse(init.body) : {},
    inFlight,
    tag: new Headers(init.headers).get("if-none-match") ?? undefined,
  };
  appendFileSync(log, `${JSON.stringify(sent)}\n`);
  await new Promise((resolve) => setTimeout(resolve, answerDelay));
  inFlight -= 1;
  const key = findKey(sent.method, new URL(sent.url), sent.body);
  const answer = recording[key];
  if (!answer) {
    return Response.json(
      { message: `the recording has no answer for ${key}` },
      { status: 404 },
    );
  }
  const headers = { "content-type": "application/json", ...answer.headers };
  // GitHub answers "not modified", with no body, to a request carrying the
  // entity tag of the answer it would give.
  if (sent.tag !== undefined && sent.tag === answer.headers?.etag) {
    return new Response(null, { status: 304, headers });
  }
  // Every GraphQL document docket sends asks for the rate figures.
  const body =
    answer.data === undefined
      ? answer.body
      : { data: { rateLimit: recordedRateLimit, ...answer.data } };
  return new Response(JSON.stringify(body), {
    status: answer.status ?? 200,
    headers,
  });
}) as typeof fetch;
