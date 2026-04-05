import type { RepissueConfigMerged } from '../../config/configSchema.js';
import type { ProgressCallback } from '../../shared/types.js';
import { buildHeaders, buildUrl, defaultFetchPage, type FetchPageFn } from './githubClient.js';
import { githubPRListSchema, type GitHubPR } from './githubTypes.js';
// import { computeSinceDate } from './issueFetch.js';

type PRFetchDeps = { fetchPage: FetchPageFn };

/**
 * Fetch a single state's worth of PRs, paginating to completion.
 * Note: the /pulls endpoint does NOT support a `since` query param,
 * so date filtering for merged PRs is done client-side via merged_at.
 */
const fetchPRsByState = async (
  repo: string,
  state: 'open' | 'closed',
  headers: Record<string, string>,
  progressCallback: ProgressCallback,
  deps: PRFetchDeps,
): Promise<GitHubPR[]> => {
  const allPRs: GitHubPR[] = [];

  let nextUrl: string | null = buildUrl(`/repos/${repo}/pulls`, { state });

  while (nextUrl !== null) {
    // eslint-disable-next-line no-await-in-loop
    const { data, nextUrl: next } = await deps.fetchPage(nextUrl, githubPRListSchema, headers) as { data: GitHubPR[]; nextUrl: string | null };

    allPRs.push(...data);
    progressCallback(`Fetched ${allPRs.length} ${state} PRs…`);
    nextUrl = next;
  }

  return allPRs;
};

/**
 * Filter closed PRs to only those merged within the last `days` days.
 * PRs closed without merging (merged_at === null) are excluded.
 * Exported for testability.
 */
export const filterMergedWithinDays = (prs: GitHubPR[], days: number, now = new Date()): GitHubPR[] => {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
  return prs.filter((pr) => {
    if (pr.merged_at === null) return false;
    return new Date(pr.merged_at) >= cutoff;
  });
};

/**
 * Merge open and recently-merged PR arrays, deduplicating by PR number.
 * Open PRs take precedence in the unlikely event of a number collision.
 */
const mergePRs = (open: GitHubPR[], merged: GitHubPR[]): GitHubPR[] => {
  const map = new Map<number, GitHubPR>();
  for (const pr of merged) map.set(pr.number, pr);
  for (const pr of open) map.set(pr.number, pr);
  return [...map.values()];
};

export const fetchPRs = async (
  repo: string,
  config: RepissueConfigMerged,
  progressCallback: ProgressCallback = () => {},
  deps: PRFetchDeps = { fetchPage: defaultFetchPage },
): Promise<GitHubPR[]> => {
  const headers = buildHeaders(config.github.token);
  const { includeMergedDays } = config.github;

  // Always fetch open PRs
  const openPRs = await fetchPRsByState(repo, 'open', headers, progressCallback, deps);

  // Optionally fetch recently merged PRs
  if (includeMergedDays === undefined) {
    return openPRs;
  }

  progressCallback(`Fetching PRs merged in the last ${includeMergedDays} day(s)…`);
  const closedPRs = await fetchPRsByState(repo, 'closed', headers, progressCallback, deps);

  const recentlyMerged = filterMergedWithinDays(closedPRs, includeMergedDays);
  progressCallback(`Fetched ${recentlyMerged.length} recently merged PR(s)`);

  return mergePRs(openPRs, recentlyMerged);
};