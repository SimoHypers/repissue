import type { GitHubIssue, GitHubPR } from '../github/githubTypes.js';

/**
 * Compute a priority score for an issue or PR based on its labels.
 * Higher score = higher priority = sorts to the top.
 *
 * The score is based on position in labelPriority: first label in the list
 * gets the highest score. Items with no priority labels score 0.
 */
export const computeLabelScore = (
  labels: Array<{ name: string }>,
  labelPriority: string[],
): number => {
  let best = -1;

  for (const label of labels) {
    const idx = labelPriority.indexOf(label.name);
    if (idx !== -1) {
      // Earlier in labelPriority = higher priority = higher score
      const score = labelPriority.length - idx;
      if (score > best) best = score;
    }
  }

  return Math.max(best, 0);
};

/**
 * Sort issues by label priority descending, then by comment count descending
 * (most active high-priority issues first), then by creation date ascending
 * (oldest first within same priority tier).
 */
export const sortIssuesByPriority = (
  issues: GitHubIssue[],
  labelPriority: string[],
): GitHubIssue[] =>
  [...issues].sort((a, b) => {
    const scoreDiff = computeLabelScore(b.labels, labelPriority) - computeLabelScore(a.labels, labelPriority);
    if (scoreDiff !== 0) return scoreDiff;

    const commentDiff = b.comments - a.comments;
    if (commentDiff !== 0) return commentDiff;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

/**
 * Sort PRs by label priority descending, then draft status (non-draft first),
 * then by updated_at descending (most recently active first).
 */
export const sortPRsByPriority = (
  prs: GitHubPR[],
  labelPriority: string[],
): GitHubPR[] =>
  [...prs].sort((a, b) => {
    const scoreDiff = computeLabelScore(b.labels, labelPriority) - computeLabelScore(a.labels, labelPriority);
    if (scoreDiff !== 0) return scoreDiff;

    // Non-draft before draft
    if (a.draft !== b.draft) return a.draft ? 1 : -1;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });