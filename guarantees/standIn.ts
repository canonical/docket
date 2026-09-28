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
 * - The machine: the first line of that file is the time zone this
 *   process runs in, as the process itself reads it, so a caller can see
 *   that the machine's time zone it asked for reached docket.
 *
 * A request the recording holds no answer for gets a 404 naming it, which
 * docket reports as a failure, so a recording that falls behind docket
 * fails loudly rather than answering with nothing.
 *
 * `GUARANTEES_BREAK`, which `bun run guarantees:prove` alone sets, makes
 * the stand-in misbehave on purpose, so an entry can be seen to fail:
 *
 * - `overlap`: each request docket sends finds another already open, as
 *   if docket had sent two at once;
 * - `shift`: every instant in a recorded answer is an hour later.
 *
 * @note Impure: replaces two globals and appends to a file.
 */
import { appendFileSync } from "node:fs";
import type { Recording, SentRequest } from "./types.js";

const {
  GUARANTEES_NOW,
  GUARANTEES_RECORDING,
  GUARANTEES_REQUESTS,
  GUARANTEES_BREAK,
} = process.env;
if (!GUARANTEES_NOW || !GUARANTEES_RECORDING || !GUARANTEES_REQUESTS) {
  throw new Error(
    "the stand-in needs GUARANTEES_NOW, GUARANTEES_RECORDING and GUARANTEES_REQUESTS",
  );
}
// A misspelt break would leave the stand-in whole, and the entry it was
// meant to break would pass as though it could not fail.
if (GUARANTEES_BREAK && !["overlap", "shift"].includes(GUARANTEES_BREAK)) {
  throw new Error(
    `the stand-in has no break \`${GUARANTEES_BREAK}\`: overlap or shift`,
  );
}
const fixed = new Date(GUARANTEES_NOW).getTime();
const recording: Recording = (await import(GUARANTEES_RECORDING)).default;
const log = GUARANTEES_REQUESTS;
appendFileSync(
  log,
  `${JSON.stringify({ machineZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}\n`,
);

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

/**
 * Holds one request open for as long as an answer takes, counted in
 * `inFlight` from start to end. `onOpen` receives how many requests are
 * open, this one included, once it is.
 */
const holdOpen = async (onOpen: (open: number) => void) => {
  inFlight += 1;
  onOpen(inFlight);
  await new Promise((resolve) => setTimeout(resolve, answerDelay));
  inFlight -= 1;
};

/** `text` with every instant in it an hour later. */
const shiftInstants = (text: string) =>
  text.replace(
    /"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"/g,
    (_, at: string) =>
      JSON.stringify(new RealDate(Date.parse(at) + 3_600_000).toISOString()),
  );

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
  const request = {
    method: init.method ?? "GET",
    url: String(input),
    body: typeof init.body === "string" ? JSON.parse(init.body) : {},
    tag: new Headers(init.headers).get("if-none-match") ?? undefined,
  };
  // The other request is held open like any other and logged nowhere, so
  // only the count of open requests shows it.
  if (GUARANTEES_BREAK === "overlap") void holdOpen(() => {});
  await holdOpen((open) => {
    const sent: SentRequest = { ...request, inFlight: open };
    appendFileSync(log, `${JSON.stringify(sent)}\n`);
  });
  const key = findKey(request.method, new URL(request.url), request.body);
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
  if (request.tag !== undefined && request.tag === answer.headers?.etag) {
    return new Response(null, { status: 304, headers });
  }
  // Every GraphQL document docket sends asks for the rate figures.
  const body =
    answer.data === undefined
      ? answer.body
      : { data: { rateLimit: recordedRateLimit, ...answer.data } };
  const text = JSON.stringify(body);
  return new Response(
    GUARANTEES_BREAK === "shift" ? shiftInstants(text) : text,
    {
      status: answer.status ?? 200,
      headers,
    },
  );
}) as typeof fetch;
