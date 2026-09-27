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
 * `Snapshot org/repo`, followed by `#12` when the request names a thread.
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
}

/** What one call of docket printed, how it exited, and what it asked GitHub. */
export interface Outcome {
  readonly code: number;
  readonly out: string;
  readonly err: string;
  readonly requests: readonly SentRequest[];
}
