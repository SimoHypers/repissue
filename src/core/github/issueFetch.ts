import type { RepissueConfigMerged } from '../../config/configSchema.js';
import type { ProgressCallback } from '../../shared/types.js';
import { buildHeaders, buildUrl, defaultFetchPage, type FetchPageFn } from './githubClient.js';
import { githubIssueListSchema, type GitHubIssue } from './githubTypes.js';

type IssuesFetchDeps = { fetchPage: FetchPageFn };

/**
 * Fetch a single state's worth of issues (open or closed), paginating to completion.
 * Returns issues-only — PRs that appear in the /issues endpoint are stripped here.
 */
const fetchIssuesByState = async (
  repo: string,
  state: 'open' | 'closed',
  headers: Record<string, string>,
  progressCallback: ProgressCallback,
  deps: IssuesFetchDeps,
  since?: string, // ISO 8601 — filters by updated_at on the GitHub side
): Promise<GitHubIssue[]> => {
  const allIssues: GitHubIssue[] = [];

  const params: Record<string, string> = { state };
  if (since !== undefined) params['since'] = since;

  let nextUrl: string | null = buildUrl(`/repos/${repo}/issues`, params);

  while (nextUrl !== null) {
    // eslint-disable-next-line no-await-in-loop
    const { data, nextUrl: next } = await deps.fetchPage(nextUrl, githubIssueListSchema, headers) as { data: GitHubIssue[]; nextUrl: string | null };

    // The /issues endpoint returns PRs too — filter them out
    const issuesOnly = data.filter((item) => item.pull_request === undefined);
    allIssues.push(...issuesOnly);
    progressCallback(`Fetched ${allIssues.length} ${state} issues…`);
    nextUrl = next;
  }

  return allIssues;
};

/**
 * Compute an ISO 8601 date string for `days` days ago from now.
 * Exported for testability.
 */
export const computeSinceDate = (days: number, now = new Date()): string => {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
  return cutoff.toISOString();
};

/**
 * Merge open and closed issue arrays, deduplicating by issue number.
 * Open issues take precedence in the unlikely event of a number collision.
 */
const mergeIssues = (open: GitHubIssue[], closed: GitHubIssue[]): GitHubIssue[] => {
  const map = new Map<number, GitHubIssue>();
  // Insert closed first so open entries overwrite on collision
  for (const issue of closed) map.set(issue.number, issue);
  for (const issue of open) map.set(issue.number, issue);
  return [...map.values()];
};

export const fetchIssues = async (
  repo: string,
  config: RepissueConfigMerged,
  progressCallback: ProgressCallback = () => {},
  deps: IssuesFetchDeps = { fetchPage: defaultFetchPage },
): Promise<GitHubIssue[]> => {
  const headers = buildHeaders(config.github.token);
  const { includeClosedDays } = config.github;

  // Always fetch open issues
  const openIssues = await fetchIssuesByState(repo, 'open', headers, progressCallback, deps);

  // Optionally fetch recently closed issues
  if (includeClosedDays === undefined) {
    return openIssues;
  }

  progressCallback(`Fetching issues closed in the last ${includeClosedDays} day(s)…`);
  const since = computeSinceDate(includeClosedDays);
  const closedIssues = await fetchIssuesByState(repo, 'closed', headers, progressCallback, deps, since);

  progressCallback(`Fetched ${closedIssues.length} recently closed issue(s)`);
  return mergeIssues(openIssues, closedIssues);
};