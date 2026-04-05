import { describe, it, expect, vi } from 'vitest';
import { fetchIssues, computeSinceDate } from '../../../src/core/github/issueFetch.ts';
import { defaultConfig } from '../../../src/config/defaultConfig.ts';
import { makeIssue } from '../../fixtures/githubFixtures.ts';
import type { FetchPageFn } from '../../../src/core/github/githubClient.ts';
import type { GitHubIssue } from '../../../src/core/github/githubTypes.ts';

const REPO = 'owner/repo';

const makeFetchPage = (issues: GitHubIssue[], nextUrl: string | null = null): FetchPageFn =>
  vi.fn().mockResolvedValue({ data: issues, nextUrl });

const makePaginatedFetchPage = (page1: GitHubIssue[], page2: GitHubIssue[]): FetchPageFn => {
  const fn = vi.fn();
  fn.mockResolvedValueOnce({ data: page1, nextUrl: 'https://api.github.com/page2' });
  fn.mockResolvedValueOnce({ data: page2, nextUrl: null });
  return fn;
};

// ── computeSinceDate ────────────────────────────────────────────────────────

describe('computeSinceDate', () => {
  it('returns an ISO 8601 string', () => {
    const result = computeSinceDate(7);
    expect(() => new Date(result)).not.toThrow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns a date exactly N days before the supplied "now"', () => {
    const now = new Date('2026-04-04T12:00:00.000Z');
    const result = computeSinceDate(7, now);
    const expected = new Date('2026-03-28T12:00:00.000Z');
    expect(new Date(result).getTime()).toBe(expected.getTime());
  });

  it('handles 1 day correctly', () => {
    const now = new Date('2026-04-04T00:00:00.000Z');
    const result = computeSinceDate(1, now);
    expect(new Date(result).getTime()).toBe(new Date('2026-04-03T00:00:00.000Z').getTime());
  });

  it('handles 30 days correctly', () => {
    const now = new Date('2026-04-04T00:00:00.000Z');
    const result = computeSinceDate(30, now);
    expect(new Date(result).getTime()).toBe(new Date('2026-03-05T00:00:00.000Z').getTime());
  });
});

// ── fetchIssues — baseline (no closed days) ─────────────────────────────────

describe('fetchIssues — without includeClosedDays', () => {
  it('returns open issues from a single page', async () => {
    const issues = [makeIssue({ number: 1 }), makeIssue({ number: 2 })];
    const fetchPage = makeFetchPage(issues);

    const result = await fetchIssues(REPO, defaultConfig, () => {}, { fetchPage });

    expect(result).toHaveLength(2);
    expect(result[0].number).toBe(1);
  });

  it('returns an empty array when there are no open issues', async () => {
    const fetchPage = makeFetchPage([]);
    const result = await fetchIssues(REPO, defaultConfig, () => {}, { fetchPage });
    expect(result).toEqual([]);
  });

  it('follows pagination across multiple pages', async () => {
    const fetchPage = makePaginatedFetchPage(
      [makeIssue({ number: 1 })],
      [makeIssue({ number: 2 })],
    );
    const result = await fetchIssues(REPO, defaultConfig, () => {}, { fetchPage });
    expect(result).toHaveLength(2);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('filters out pull requests that appear in the /issues endpoint', async () => {
    const realIssue = makeIssue({ number: 1 });
    const prDisguised = {
      ...makeIssue({ number: 2 }),
      pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/2' },
    };
    const fetchPage = makeFetchPage([realIssue, prDisguised]);

    const result = await fetchIssues(REPO, defaultConfig, () => {}, { fetchPage });

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it('calls fetchPage with state=open', async () => {
    const fetchPage = makeFetchPage([]);
    await fetchIssues(REPO, defaultConfig, () => {}, { fetchPage });

    const url = (fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('state=open');
    expect(url).toContain('/repos/owner/repo/issues');
  });

  it('does NOT call fetchPage a second time for closed issues when includeClosedDays is unset', async () => {
    const fetchPage = makeFetchPage([makeIssue({ number: 1 })]);
    await fetchIssues(REPO, defaultConfig, () => {}, { fetchPage });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('includes the Authorization header when a token is configured', async () => {
    const config = { ...defaultConfig, github: { ...defaultConfig.github, token: 'ghp_test' } };
    const fetchPage = makeFetchPage([]);
    await fetchIssues(REPO, config, () => {}, { fetchPage });

    const headers = (fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer ghp_test');
  });

  it('omits Authorization header when no token is configured', async () => {
    const fetchPage = makeFetchPage([]);
    await fetchIssues(REPO, defaultConfig, () => {}, { fetchPage });

    const headers = (fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('fires the progressCallback after each page', async () => {
    const fetchPage = makePaginatedFetchPage([makeIssue({ number: 1 })], [makeIssue({ number: 2 })]);
    const progress = vi.fn();

    await fetchIssues(REPO, defaultConfig, progress, { fetchPage });

    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(expect.stringContaining('issue'));
  });
});

// ── fetchIssues — with includeClosedDays ────────────────────────────────────

describe('fetchIssues — with includeClosedDays', () => {
  const configWith = (days: number) => ({
    ...defaultConfig,
    github: { ...defaultConfig.github, includeClosedDays: days },
  });

  it('makes a second fetchPage call for closed issues', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });
    // One call for open, one call for closed
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls fetchPage with state=closed on the second call', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });

    const secondUrl = fn.mock.calls[1][0] as string;
    expect(secondUrl).toContain('state=closed');
  });

  it('passes a `since` query param on the closed call', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });

    const secondUrl = fn.mock.calls[1][0] as string;
    expect(secondUrl).toContain('since=');
  });

  it('the since param is approximately N days ago', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    const before = Date.now();
    await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });
    const after = Date.now();

    const secondUrl = fn.mock.calls[1][0] as string;
    const sinceParam = new URL(secondUrl).searchParams.get('since')!;
    const sinceMs = new Date(sinceParam).getTime();

    const expectedMs = before - 7 * 24 * 60 * 60 * 1_000;
    // Allow 5 seconds of clock drift in either direction
    expect(sinceMs).toBeGreaterThanOrEqual(expectedMs - 5_000);
    expect(sinceMs).toBeLessThanOrEqual(after);
  });

  it('merges open and closed results', async () => {
    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [makeIssue({ number: 1, state: 'open' })], nextUrl: null });
    fn.mockResolvedValueOnce({ data: [makeIssue({ number: 2, state: 'closed' })], nextUrl: null });

    const result = await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(2);
    expect(result.some((i) => i.number === 1)).toBe(true);
    expect(result.some((i) => i.number === 2)).toBe(true);
  });

  it('deduplicates by number — open entry wins on collision', async () => {
    const openVersion = makeIssue({ number: 42, state: 'open', title: 'Open version' });
    const closedVersion = makeIssue({ number: 42, state: 'closed', title: 'Closed version' });

    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [openVersion], nextUrl: null });
    fn.mockResolvedValueOnce({ data: [closedVersion], nextUrl: null });

    const result = await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Open version');
  });

  it('still filters out PRs from the closed results', async () => {
    const closedIssue = makeIssue({ number: 10, state: 'closed' });
    const closedPR = {
      ...makeIssue({ number: 11, state: 'closed' }),
      pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/11' },
    };

    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [], nextUrl: null }); // open
    fn.mockResolvedValueOnce({ data: [closedIssue, closedPR], nextUrl: null }); // closed

    const result = await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(10);
  });

  it('returns only open issues when no closed issues are found', async () => {
    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [makeIssue({ number: 1 })], nextUrl: null });
    fn.mockResolvedValueOnce({ data: [], nextUrl: null });

    const result = await fetchIssues(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it('fires progress callbacks for both open and closed fetch stages', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    const messages: string[] = [];

    await fetchIssues(REPO, configWith(3), (msg) => messages.push(msg), { fetchPage: fn });

    // Should have at least one message mentioning closed
    expect(messages.some((m) => m.toLowerCase().includes('closed'))).toBe(true);
  });
});