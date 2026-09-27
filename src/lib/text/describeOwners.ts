/**
 * Names who owns a thread or a wait in words, for an agent: `owner alice`,
 * `owners alice, bob`, or `unassigned` when there is none.
 */
export default function describeOwners(owners: readonly string[]): string {
  if (owners.length === 0) return "unassigned";
  return `${owners.length > 1 ? "owners" : "owner"} ${owners.join(", ")}`;
}
