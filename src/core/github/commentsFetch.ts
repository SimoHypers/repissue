import type { RepissueConfigMerged } from '../../config/configSchema.js';
import type { ProgressCallback } from '../../shared/types.js';
import { buildHeaders, buildUrl, defaultFetchPage, type FetchPageFn } from './githubClient.js';
import { githubCommentListSchema, type GitHubComment } from './githubTypes.js';

const DEFAULT_CONCURRENCY = 5;

// Spawn `concurrency` workers that each drain from the shared queue.
// This keeps exactly N requests in-flight at all times without needing
// a semaphore — and preserves result order via the index.
const runBounded = async <T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  const queue = tasks.map((task, index) => ({ task, index }));

  const worker = async (): Promise<void> => {
    let item = queue.shift();
    while (item !== undefined) {
      const { task, index } = item;
      results[index] = await task(); // eslint-disable-line no-await-in-loop
      item = queue.shift();
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
};

type CommentsFetchDeps = { fetchPage: FetchPageFn };

export const fetchComments = async (
  repo: string,
  itemNumbers: number[],
  config: RepissueConfigMerged,
  progressCallback: ProgressCallback = () => {},
  deps: CommentsFetchDeps = { fetchPage: defaultFetchPage },
): Promise<Map<number, GitHubComment[]>> => {
  const { token, maxCommentsPerItem } = config.github;
  const headers = buildHeaders(token);

  const fetchForNumber = async (number: number): Promise<[number, GitHubComment[]]> => {
    const allComments: GitHubComment[] = [];
    let nextUrl: string | null = buildUrl(`/repos/${repo}/issues/${number}/comments`);

    while (nextUrl !== null && allComments.length < maxCommentsPerItem) {
      const { data, nextUrl: next } = await deps.fetchPage(nextUrl, githubCommentListSchema, headers) as { data: GitHubComment[]; nextUrl: string | null };
      allComments.push(...data);
      nextUrl = next;
    }

    progressCallback(`Fetched comments for #${number}`);
    return [number, allComments.slice(0, maxCommentsPerItem)];
  };

  const tasks = itemNumbers.map((n) => () => fetchForNumber(n));
  const pairs = await runBounded(tasks, DEFAULT_CONCURRENCY);
  return new Map(pairs);
};