/**
 * A GitHub account as a provider records it where the account acts: an
 * assignee, a requested reviewer, or the actor of an event.
 */
export interface Account {
  readonly login: string;
  /** The account type the provider records; `bot` marks automation. */
  readonly type: "user" | "bot";
}

/**
 * The account that wrote a thread, a comment or a review. GitHub records
 * the author's relation to the repository only on what they wrote, so only
 * an author says whether it is a member of the organisation.
 */
export interface Author extends Account {
  /**
   * Whether the provider marks the account as a member of the organisation
   * that owns the repository.
   */
  readonly member: boolean;
}
