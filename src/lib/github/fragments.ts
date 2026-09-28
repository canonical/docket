/** The rate figures every document asks for, so the budget stays known. */
const rateLimit = "rateLimit { limit remaining resetAt }";
const account = "login __typename";

/**
 * The GraphQL selections several documents share, so each field is named
 * once and every document reads it alike.
 */
const fragments = {
  rateLimit,
  /** An account: its login, and its type, which tells a bot apart. */
  account,
  /** A thread's first ten assignees, each an account. */
  assignees: `assignees(first: 10) { nodes { ${account} } }`,
  /** A thread's first ten labels, by name. */
  labels: "labels(first: 10) { nodes { name } }",
  /** Something written: its author, and the author's tie to the repository. */
  written: `author { ${account} } authorAssociation`,
  /** A requested reviewer: a person, a bot, or a team by its full name. */
  requestedReviewer: `requestedReviewer { __typename ... on User { login } ... on Bot { login } ... on Team { combinedSlug } }`,
  /** A check on a commit: a check run, or a commit status. */
  check: `__typename
  ... on CheckRun { name status conclusion completedAt checkSuite { app { slug } } }
  ... on StatusContext { context state createdAt creator { ${account} } }`,
  /** Where a pull request sits in its stack. */
  stackEntry: "stackEntry { position stack { number size baseRefName } }",
  pageInfo: "pageInfo { hasNextPage endCursor }",
  /** Newest update first, so a read since an instant stops early. */
  order: "orderBy: { field: UPDATED_AT, direction: DESC }",
};

export default fragments;
