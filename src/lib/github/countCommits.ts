/**
 * Counts the commits a push added to a pull request, from the pull
 * request's commits, oldest first, and the heads before and after the
 * push. It is absent when either head is not among the commits, as after
 * a force push or when the push predates the commits listed.
 */
export default function countCommits(
  commits: readonly string[],
  before: string,
  after: string,
): number | undefined {
  const from = commits.indexOf(before);
  const to = commits.indexOf(after);
  return from >= 0 && to > from ? to - from : undefined;
}
