/**
 * One recorded answer. A GraphQL answer gives `data`, which the stand-in
 * sends with the rate figures every document asks for; a REST answer
 * gives `body`, and either may give a status and headers. An answer
 * carrying an `etag` header is answered "not modified" to a request that
 * sends that tag back.
 */
export interface RecordedAnswer {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly data?: Readonly<Record<string, unknown>>;
}

/**
 * The answers GitHub gives, keyed by request: `GET /repos/org/repo/issues`
 * for REST, and for GraphQL the operation and repository, such as
 * `Snapshot org/repo`, followed by `#12` when the request names a thread,
 * or the operation alone, such as `Viewer`, when it names no
 * repository.
 */
export type Recording = Readonly<Record<string, RecordedAnswer>>;

/** A request the stand-in received, as it logs it. */
export interface SentRequest {
  readonly method: string;
  readonly url: string;
  readonly body: Record<string, unknown>;
  /** How many requests were open, this one included, when it was sent. */
  readonly inFlight: number;
  /** The entity tag it sent back, if any. */
  readonly tag: string | undefined;
  /** When it was sent, on the stand-in's clock. */
  readonly at: string;
}

/** What one call of docket printed, how it exited, what it asked GitHub, and the time zone it ran in. */
export interface Outcome {
  readonly code: number;
  readonly out: string;
  readonly err: string;
  readonly requests: readonly SentRequest[];
  /**
   * The time zone docket's process ran in, as that process read it; none
   * when the stand-in never loaded.
   */
  readonly machineZone: string | undefined;
}

/** How one call is made. */
export interface Call {
  /** The instant docket reads as now, such as `2026-09-28T10:00:00Z`. */
  readonly now: string;
  /** The recording module under `fixtures/`, such as `team`, that answers for GitHub. */
  readonly recording: string;
  /** The machine's time zone, which no output may depend on. */
  readonly machineZone?: string;
  /**
   * How many of GitHub's hourly 5,000 points every GraphQL answer says
   * are left, 4,900 unless given.
   */
  readonly remaining?: number;
}

/** A minute passing while keys are pressed, as a person pausing. */
export interface Pause {
  readonly pause: "minute";
}

/**
 * A key whose effect is a read of details that names `reads`, a thread as
 * `owner/name#number`: the next key, or the end of the keys, waits until
 * docket has sent it, so each move is a stop however slow the machine.
 */
export interface ReadingKey {
  readonly key: string;
  readonly reads: string;
}

/** How the terminal interface is opened, and what a person does in it. */
export interface Opening extends Call {
  /**
   * The instant the stand-in's clock runs to, a day passing in seconds,
   * when docket's process ends.
   */
  readonly until: string;
  /**
   * The keys pressed once the interface has drawn `ready`, one at a time,
   * each `pause` milliseconds of real time after the last, 250 unless
   * given: the stand-in's clock stands still until the last is pressed,
   * but for each `Pause` among them, which moves it on by a minute. A
   * `ReadingKey` holds the next key until the read it causes is sent.
   */
  readonly keys?: readonly (string | Pause | ReadingKey)[];
  readonly ready?: string;
  readonly pause?: number;
  /**
   * The recording module GitHub answers from once the clock first moves
   * on through a wait of docket's, as if something changed on GitHub
   * meanwhile.
   */
  readonly changed?: string;
}

/** A temporary home, and docket run in it. */
export interface Home {
  call(args: readonly string[], call: Call): Promise<Outcome>;
  /**
   * Opens the terminal interface in a pseudo-terminal, as a person does
   * with `docket` alone, until the stand-in's clock reaches `until`.
   * `out` is everything the interface drew.
   */
  open(opening: Opening): Promise<Outcome>;
  remove(): void;
}

/** The text written on GitHub that a recording carries. */
export interface Words {
  readonly title: string;
  readonly comment: string;
  readonly label: string;
  readonly check: string;
  readonly branch: string;
}
