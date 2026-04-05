import { RepissueError, rethrowValidationErrorIfZodError } from '../../shared/errorHandle.js';
import { logger } from '../../shared/logger.js';
import { sleep, defaultParseRateLimit, type ParseRateLimitFn } from './rateLimitHandle.js';

const MAX_RETRIES = 3;
const PER_PAGE = 100;
const GITHUB_API_BASE = 'https://api.github.com';

// Generic schema shape — any object with a parse() method (all Zod schemas satisfy this)
export type SchemaLike<T> = { parse: (data: unknown) => T };
export type FetchPageFn = <T>(
  url: string,
  schema: SchemaLike<T>,
  headers: Record<string, string>,
) => Promise<{ data: T; nextUrl: string | null }>;

export const buildHeaders = (token?: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
});

export const buildUrl = (path: string, params: Record<string, string> = {}): string => {
  const url = new URL(`${GITHUB_API_BASE}${path}`);
  url.searchParams.set('per_page', String(PER_PAGE));
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
};

const parseLinkHeader = (link: string | null): string | null => {
  if (!link) return null;
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1] ?? null;
};

type FetchPageDeps = { parseRateLimit: ParseRateLimitFn };

const makeDefaultFetchPage = (deps: FetchPageDeps): FetchPageFn =>
  async <T>(
    url: string,
    schema: SchemaLike<T>,
    headers: Record<string, string>,
  ): Promise<{ data: T; nextUrl: string | null }> => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url, { headers });

      const isRateLimited =
        response.status === 429 ||
        (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0');

      if (isRateLimited) {
        if (attempt < MAX_RETRIES) {
          const info = deps.parseRateLimit(response.headers);
          logger.warn(`Rate limit hit — waiting ${Math.ceil(info.waitMs / 1_000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(info.waitMs);
        } else {
          const info = deps.parseRateLimit(response.headers);
          const resetTime = new Date(info.resetAt).toLocaleTimeString();
          throw new RepissueError(
            `GitHub rate limit exceeded. Resets at ${resetTime}. Set GITHUB_TOKEN for 5,000 req/hr.`,
          );
        }
      } else if (response.status === 404) {
        throw new RepissueError('Repository not found. Check the owner/repo format and your access permissions.');
      } else if (response.status === 401) {
        throw new RepissueError('GitHub authentication failed. Check your personal access token.');
      } else if (!response.ok) {
        throw new RepissueError(`GitHub API error: ${response.status} ${response.statusText}`);
      } else {
        const raw: unknown = await response.json(); // eslint-disable-line no-await-in-loop
        try {
          const data = schema.parse(raw);
          const nextUrl = parseLinkHeader(response.headers.get('link'));
          return { data, nextUrl };
        } catch (err) {
          rethrowValidationErrorIfZodError(err, 'Unexpected GitHub API response shape');
          throw err;
        }
      }
    }
    throw new RepissueError('Max retries exceeded');
  };

export const defaultFetchPage: FetchPageFn = makeDefaultFetchPage({
  parseRateLimit: defaultParseRateLimit,
});
