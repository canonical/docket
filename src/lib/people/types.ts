/**
 * A GitHub account as a provider records it where the account acts: the
 * author of a thread, a comment, a review or a push, an assignee, or a
 * requested reviewer.
 */
export interface Account {
  readonly login: string;
  /** The account type the provider records; `bot` marks automation. */
  readonly type: "user" | "bot";
  /**
   * Whether the provider marks the account as a member of the organisation
   * that owns the repository.
   */
  readonly member: boolean;
}
