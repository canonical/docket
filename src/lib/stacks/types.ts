/**
 * Where a pull request sits in a stack, as the provider records it. A
 * provider without stacks records none.
 */
export interface StackEntry {
  /** The stack's number, unique within its repository and separate from issue and pull-request numbers. */
  readonly number: number;
  /** The pull request's place in the stack; 1 is nearest the base. */
  readonly position: number;
  /** How many pull requests the stack holds. */
  readonly size: number;
  /** The branch the stack is based on. */
  readonly base: string;
}

/** A thread that may sit in a stack. */
export interface Stackable {
  /** `owner/name` on GitHub. */
  readonly repo: string;
  readonly stack?: StackEntry;
}

/** One stack, and the pull requests of it that were given, bottom first. */
export interface Stack<T extends Stackable> {
  readonly repo: string;
  readonly number: number;
  /** The stack's full size, which may exceed the members given. */
  readonly size: number;
  readonly base: string;
  readonly members: readonly T[];
}
