import { describe, it, expect, vi } from 'vitest';
import { fetchPRs, filterMergedWithinDays } from '../../../src/core/github/prFetch.ts';
import { defaultConfig } from '../../../src/config/defaultConfig.ts';
import { makePR } from '../../fixtures/githubFixtures.ts';
import type { FetchPageFn } from '../../../src/core/github/githubClient.ts';
import type { GitHubPR } from '../../../src/core/github/githubTypes.ts';

const REPO = 'owner/repo';

const makeFetchPage = (prs: GitHubPR[], nextUrl: string | null = null): FetchPageFn =>
  vi.fn().mockResolvedValue({ data: prs, nextUrl });

const makePaginatedFetchPage = (page1: GitHubPR[], page2: GitHubPR[]): FetchPageFn => {
  const fn = vi.fn();
  fn.mockResolvedValueOnce({ data: page1, nextUrl: 'https://api.github.com/page2' });
  fn.mockResolvedValueOnce({ data: page2, nextUrl: null });
  return fn;
};

// ── filterMergedWithinDays ───────────────────────────────────────────────────

describe('filterMergedWithinDays', () => {
  const NOW = new Date('2026-04-04T12:00:00.000Z');

  it('keeps PRs merged within the window', () => {
    const pr = makePR({ number: 1, merged_at: '2026-04-01T12:00:00.000Z' }); // 3 days ago
    const result = filterMergedWithinDays([pr], 7, NOW);
    expect(result).toHaveLength(1);
  });

  it('excludes PRs merged before the window', () => {
    const pr = makePR({ number: 1, merged_at: '2026-03-01T12:00:00.000Z' }); // 34 days ago
    const result = filterMergedWithinDays([pr], 7, NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes PRs that were closed but never merged (merged_at is null)', () => {
    const pr = makePR({ number: 1, merged_at: null });
    const result = filterMergedWithinDays([pr], 7, NOW);
    expect(result).toHaveLength(0);
  });

  it('includes a PR merged exactly at the cutoff boundary', () => {
    // Exactly 7 days ago
    const pr = makePR({ number: 1, merged_at: '2026-03-28T12:00:00.000Z' });
    const result = filterMergedWithinDays([pr], 7, NOW);
    expect(result).toHaveLength(1);
  });

  it('returns empty array when given empty input', () => {
    expect(filterMergedWithinDays([], 7, NOW)).toEqual([]);
  });

  it('handles a mix of merged, unmerged, and out-of-window PRs', () => {
    const prs = [
      makePR({ number: 1, merged_at: '2026-04-03T00:00:00.000Z' }), // within window
      makePR({ number: 2, merged_at: null }),                         // closed, not merged
      makePR({ number: 3, merged_at: '2026-01-01T00:00:00.000Z' }), // too old
      makePR({ number: 4, merged_at: '2026-04-04T11:00:00.000Z' }), // within window
    ];
    const result = filterMergedWithinDays(prs, 7, NOW);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.number)).toEqual(expect.arrayContaining([1, 4]));
  });
});

// ── fetchPRs — baseline (no merged days) ────────────────────────────────────

describe('fetchPRs — without includeMergedDays', () => {
  it('returns open PRs from a single page', async () => {
    const prs = [makePR({ number: 100 }), makePR({ number: 101 })];
    const fetchPage = makeFetchPage(prs);

    const result = await fetchPRs(REPO, defaultConfig, () => {}, { fetchPage });

    expect(result).toHaveLength(2);
    expect(result[0].number).toBe(100);
  });

  it('returns an empty array when there are no open PRs', async () => {
    const fetchPage = makeFetchPage([]);
    const result = await fetchPRs(REPO, defaultConfig, () => {}, { fetchPage });
    expect(result).toEqual([]);
  });

  it('follows pagination across multiple pages', async () => {
    const fetchPage = makePaginatedFetchPage(
      [makePR({ number: 100 })],
      [makePR({ number: 101 })],
    );
    const result = await fetchPRs(REPO, defaultConfig, () => {}, { fetchPage });
    expect(result).toHaveLength(2);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('calls fetchPage with state=open', async () => {
    const fetchPage = makeFetchPage([]);
    await fetchPRs(REPO, defaultConfig, () => {}, { fetchPage });

    const url = (fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('state=open');
    expect(url).toContain('/repos/owner/repo/pulls');
  });

  it('does NOT make a second call when includeMergedDays is unset', async () => {
    const fetchPage = makeFetchPage([makePR({ number: 100 })]);
    await fetchPRs(REPO, defaultConfig, () => {}, { fetchPage });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('includes the Authorization header when a token is configured', async () => {
    const config = { ...defaultConfig, github: { ...defaultConfig.github, token: 'ghp_test' } };
    const fetchPage = makeFetchPage([]);
    await fetchPRs(REPO, config, () => {}, { fetchPage });

    const headers = (fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer ghp_test');
  });

  it('omits Authorization header when no token is configured', async () => {
    const fetchPage = makeFetchPage([]);
    await fetchPRs(REPO, defaultConfig, () => {}, { fetchPage });

    const headers = (fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('passes through all PR fields unchanged', async () => {
    const pr = makePR({ number: 200, title: 'Fix everything', draft: true, additions: 42 });
    const fetchPage = makeFetchPage([pr]);

    const result = await fetchPRs(REPO, defaultConfig, () => {}, { fetchPage });

    expect(result[0]).toMatchObject({ number: 200, title: 'Fix everything', draft: true, additions: 42 });
  });

  it('fires the progressCallback after each page', async () => {
    const fetchPage = makePaginatedFetchPage([makePR({ number: 100 })], [makePR({ number: 101 })]);
    const progress = vi.fn();

    await fetchPRs(REPO, defaultConfig, progress, { fetchPage });

    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(expect.stringContaining('PR'));
  });
});

// ── fetchPRs — with includeMergedDays ───────────────────────────────────────

describe('fetchPRs — with includeMergedDays', () => {
  const configWith = (days: number) => ({
    ...defaultConfig,
    github: { ...defaultConfig.github, includeMergedDays: days },
  });

  it('makes a second fetchPage call for closed PRs', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls fetchPage with state=closed on the second call', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });

    const secondUrl = fn.mock.calls[1][0] as string;
    expect(secondUrl).toContain('state=closed');
  });

  it('does NOT pass a since param on the closed call (not supported by /pulls)', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });

    const secondUrl = fn.mock.calls[1][0] as string;
    expect(secondUrl).not.toContain('since=');
  });

  it('merges open and recently merged results', async () => {
    const recentMergedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1_000).toISOString();

    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [makePR({ number: 100, state: 'open' })], nextUrl: null });
    fn.mockResolvedValueOnce({
      data: [makePR({ number: 200, state: 'closed', merged_at: recentMergedAt })],
      nextUrl: null,
    });

    const result = await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(2);
    expect(result.some((p) => p.number === 100)).toBe(true);
    expect(result.some((p) => p.number === 200)).toBe(true);
  });

  it('excludes closed PRs that were not merged', async () => {
    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [], nextUrl: null }); // open
    fn.mockResolvedValueOnce({
      data: [makePR({ number: 200, state: 'closed', merged_at: null })],
      nextUrl: null,
    });

    const result = await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(0);
  });

  it('excludes merged PRs outside the time window', async () => {
    const oldMergedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString();

    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [], nextUrl: null }); // open
    fn.mockResolvedValueOnce({
      data: [makePR({ number: 200, state: 'closed', merged_at: oldMergedAt })],
      nextUrl: null,
    });

    const result = await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(0);
  });

  it('deduplicates by number — open entry wins on collision', async () => {
    const recentMergedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1_000).toISOString();
    const openVersion = makePR({ number: 42, state: 'open', title: 'Open version' });
    const mergedVersion = makePR({ number: 42, state: 'closed', merged_at: recentMergedAt, title: 'Merged version' });

    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [openVersion], nextUrl: null });
    fn.mockResolvedValueOnce({ data: [mergedVersion], nextUrl: null });

    const result = await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Open version');
  });

  it('returns only open PRs when no closed PRs are within the window', async () => {
    const oldMergedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1_000).toISOString();

    const fn = vi.fn();
    fn.mockResolvedValueOnce({ data: [makePR({ number: 100 })], nextUrl: null });
    fn.mockResolvedValueOnce({
      data: [makePR({ number: 200, merged_at: oldMergedAt })],
      nextUrl: null,
    });

    const result = await fetchPRs(REPO, configWith(7), () => {}, { fetchPage: fn });

    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(100);
  });

  it('fires progress callbacks mentioning merged PRs', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], nextUrl: null });
    const messages: string[] = [];

    await fetchPRs(REPO, configWith(7), (msg) => messages.push(msg), { fetchPage: fn });

    expect(messages.some((m) => m.toLowerCase().includes('merged'))).toBe(true);
  });
});