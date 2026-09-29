import fragments from "./fragments.js";

const { account, assignees, check, labels, requestedReviewer } = fragments;
const written = `${fragments.written} body`;
const comments = `comments(last: 3) { nodes { ${written} createdAt } }`;
// The facts every kind of thread has; a discussion has no assignees.
const facts = `createdAt updatedAt ${labels}`;

/**
 * What a thread's details select, by the kind of thread, so a document
 * reading one thread and one reading several ask for the same fields.
 */
const detailFields = {
  issue: `${facts} ${assignees} ${comments}`,
  discussion: `${facts} ${comments}`,
  pullRequest: `${facts} ${assignees} ${comments}
      reviews(last: 3) { nodes { ${written} submittedAt } }
      timelineItems(last: 30, itemTypes: [REVIEW_REQUESTED_EVENT]) {
        nodes {
          ... on ReviewRequestedEvent {
            createdAt actor { ${account} }
            ${requestedReviewer}
          }
        }
      }
      files(first: 100) { nodes { path additions deletions } }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 50) { nodes { ${check} } }
            }
          }
        }
      }
      stack { entries(first: 20) { nodes { position pullRequest { number state } } } }`,
} as const;

export default detailFields;
