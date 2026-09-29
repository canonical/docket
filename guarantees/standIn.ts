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
 * - GitHub: `fetch` answers from the recording under `fixtures/` that
 *   `GUARANTEES_RECORDING` names, and appends each request it received
 *   to the file `GUARANTEES_REQUESTS` names, one JSON line each. An answer arrives a
 *   few milliseconds after its request, so two requests sent together
 *   overlap and the log shows it.
 * - The machine: the first line of that file is the time zone this
 *   process runs in, as the process itself reads it, so a caller can see
 *   that the machine's time zone it asked for reached docket.
 * - A day: with `GUARANTEES_UNTIL`, each of docket's waits of a minute or
 *   more, once or on repeat, passes at once, as soon as docket is quiet,
 *   the clock moving on to its end (`fastForward.ts`), until the clock
 *   would reach that instant, when the process ends. Nothing passes before
 *   docket's first request is answered, nor, with `GUARANTEES_KEYS`,
 *   before the one pressing keys sends `SIGUSR2` after the last. Each
 *   logged request carries the clock's time.
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
 * - `shift`: every instant in a recorded answer is an hour later;
 * - `later`: the clock reads an hour after `GUARANTEES_NOW`;
 * - `unsanitized`: `JSON.stringify` writes every string as it was given,
 *   whatever the replacer docket passes it would make of it, as if
 *   docket's JSON let text written on GitHub through untouched;
 * - `unquoted`: `JSON.stringify` writes a string given on its own
 *   without its double quotes, as if docket printed text written on
 *   GitHub bare where an agent reads it.
 *
 * @note Impure: replaces two globals, a third under `unsanitized` or
 * `unquoted`, and appends to a file.
 */
import { appendFileSync } from "node:fs";
import fastForward from "./fastForward.js";
import type { RecordedAnswer, Recording, SentRequest } from "./types.js";

const {
  GUARANTEES_NOW,
  GUARANTEES_RECORDING,
  GUARANTEES_REQUESTS,
  GUARANTEES_BREAK,
  GUARANTEES_UNTIL,
  GUARANTEES_KEYS,
} = process.env;
if (!GUARANTEES_NOW || !GUARANTEES_RECORDING || !GUARANTEES_REQUESTS) {
  throw new Error(
    "the stand-in needs GUARANTEES_NOW, GUARANTEES_RECORDING and GUARANTEES_REQUESTS",
  );
}
// A misspelt break would leave the stand-in whole, and the entry it was
// meant to break would pass as though it could not fail.
if (
  GUARANTEES_BREAK &&
  !["overlap", "shift", "later", "unsanitized", "unquoted"].includes(
    GUARANTEES_BREAK,
  )
) {
  throw new Error(
    `the stand-in has no break \`${GUARANTEES_BREAK}\`: overlap, shift, later, unsanitized or unquoted`,
  );
}
if (GUARANTEES_BREAK === "unsanitized") {
  const stringify = JSON.stringify;
  // A string is handed back as it was held, and anything else goes to
  // docket's replacer, which also writes the dates of its cache.
  const keepStrings = (
    replacer: (this: unknown, key: string, value: unknown) => unknown,
  ) =>
    function (this: Record<string, unknown>, key: string, value: unknown) {
      const held = this[key];
      return typeof held === "string" ? held : replacer.call(this, key, value);
    };
  JSON.stringify = ((value: unknown, replacer?: unknown, space?: unknown) =>
    stringify(
      value,
      typeof replacer === "function"
        ? keepStrings(replacer as Parameters<typeof keepStrings>[0])
        : (replacer as undefined),
      space as number | undefined,
    )) as typeof JSON.stringify;
}
if (GUARANTEES_BREAK === "unquoted") {
  const stringify = JSON.stringify;
  JSON.stringify = ((value: unknown, ...rest: unknown[]) =>
    typeof value === "string" && rest.length === 0
      ? value
      : stringify(value, ...(rest as [undefined]))) as typeof JSON.stringify;
}
const fixed =
  new Date(GUARANTEES_NOW).getTime() +
  (GUARANTEES_BREAK === "later" ? 3_600_000 : 0);
// Each recording is named here, so every module the corpus loads is one
// the structure check can read.
const recordings: Readonly<
  Record<string, () => Promise<{ default: Recording }>>
> = {
  clock: () => import("./fixtures/clock.js"),
  hostile: () => import("./fixtures/hostile.js"),
  team: () => import("./fixtures/team.js"),
  teamChanged: () => import("./fixtures/teamChanged.js"),
};
const load = recordings[GUARANTEES_RECORDING];
if (!load) throw new Error(`no recording named ${GUARANTEES_RECORDING}`);
const recording = (await load()).default;
const log = GUARANTEES_REQUESTS;
appendFileSync(
  log,
  `${JSON.stringify({ machineZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}\n`,
);

// How far a day passing has moved the clock on, in milliseconds.
let moved = 0;
const RealDate = Date;
class FixedDate extends RealDate {
  // biome-ignore lint/suspicious/noExplicitAny: Date's constructor takes several shapes, passed on whole.
  constructor(...args: any[]) {
    if (args.length === 0) super(fixed + moved);
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
// The clock skips nothing before docket's first request has been answered,
// which it sends as it opens, nor, when a person presses keys, before the
// one pressing them says with `SIGUSR2` that the last is pressed.
const answered = Promise.withResolvers<void>();
const pressed = Promise.withResolvers<void>();
if (GUARANTEES_KEYS) process.on("SIGUSR2", () => pressed.resolve());
else pressed.resolve();
const touch = GUARANTEES_UNTIL
  ? fastForward({
      span: new RealDate(GUARANTEES_UNTIL).getTime() - fixed,
      isQuiet: () => inFlight === 0,
      moveClock: (by) => {
        moved = by;
      },
      onEnd: () => process.exit(0),
      start: Promise.all([answered.promise, pressed.promise]).then(() => {}),
    })
  : () => {};

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
  answered.resolve();
  touch();
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
  if (variables.owner === undefined) return `${operation}`;
  const number = variables.number === undefined ? "" : `#${variables.number}`;
  return `${operation} ${variables.owner}/${variables.name}${number}`;
};

/**
 * The answer to a query reading several threads' details at once, one
 * alias per thread such as
 * `t0: repository(owner: "o", name: "r") { issue(number: 4) { … } }`,
 * built from the answer the recording holds for each thread alone
 * (`Detail o/r#4`); a thread it holds none for is `null`, as GitHub
 * answers a thread it does not find.
 */
const composeDetails = (query: string): RecordedAnswer => {
  const aliases = query.matchAll(
    /(t\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\) \{ (\w+)\(number: (\d+)\)/g,
  );
  const data = Object.fromEntries(
    [...aliases].map(([, alias, owner, name, kind, number]) => {
      const alone = recording[`Detail ${owner}/${name}#${number}`]?.data as
        | { readonly repository?: Record<string, unknown> }
        | undefined;
      const found = alone?.repository?.[kind ?? ""];
      return [alias, found ? { [kind ?? ""]: found } : null];
    }),
  );
  return { data };
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
    const sent: SentRequest = {
      ...request,
      inFlight: open,
      at: new FixedDate().toISOString(),
    };
    appendFileSync(log, `${JSON.stringify(sent)}\n`);
  });
  const key = findKey(request.method, new URL(request.url), request.body);
  const answer =
    key === "Details"
      ? composeDetails(String(request.body.query))
      : recording[key];
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
