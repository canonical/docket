/**
 * Why GitHub notified, in docket's words: `review_requested` reads
 * `review requested`, and a reason docket does not know reads `other`.
 */
const words: Readonly<Record<string, string>> = {
  agent_session_finished: "agent session finished",
  approval_requested: "approval requested",
  assign: "assigned",
  author: "author",
  ci_activity: "CI activity",
  comment: "comment",
  invitation: "invitation",
  manual: "manual",
  member_feature_requested: "feature requested",
  mention: "mention",
  review_requested: "review requested",
  security_advisory_credit: "security credit",
  security_alert: "security alert",
  state_change: "state change",
  subscribed: "subscribed",
  team_mention: "team mention",
  other: "other",
};

/** Writes one notification reason as docket names it. */
export default function describeReason(reason: string): string {
  return words[reason] ?? "other";
}
