import { describe, it, expect, vi } from 'vitest';
import { fetchComments } from '../../../src/core/github/commentsFetch.ts';
import { defaultConfig } from '../../../src/config/defaultConfig.ts';
import { makeComment } from '../../fixtures/githubFixtures.ts';
import type { FetchPageFn } from '../../../src/core/github/githubClient.ts';
import type { GitHubComment } from '../../../src/core/github/githubTypes.ts';

const REPO = 'owner/repo';

// A fetchPage that always returns the given comments with no next page.
const makeFetchPage = (comments: GitHubComment[], nextUrl: string | null = null): FetchPageFn =>
  vi.fn().mockResolvedValue({ data: comments, nextUrl });

describe('fetchComments', () => {
  it('returns an empty map when given no item numbers', async () => {
    const fetchPage = makeFetchPage([]);
    const result = await fetchComments(REPO, [], defaultConfig, () => {}, { fetchPage });

    expect(result.size).toBe(0);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('returns a map entry for each requested item number', async () => {
    const comments = [makeComment({ id: 1, body: 'Hello' })];
    const fetchPage = makeFetchPage(comments);

    const result = await fetchComments(REPO, [42, 99], defaultConfig, () => {}, { fetchPage });

    expect(result.has(42)).toBe(true);
    expect(result.has(99)).toBe(true);
  });

  it('returns the fetched comments for a given item number', async () => {
    const comments = [
      makeComment({ id: 1, body: 'First comment' }),
      makeComment({ id: 2, body: 'Second comment' }),
    ];
    const fetchPage = makeFetchPage(comments);

    const result = await fetchComments(REPO, [1], defaultConfig, () => {}, { fetchPage });

    expect(result.get(1)).toHaveLength(2);
    expect(result.get(1)![0].body).toBe('First comment');
  });

  it('returns an empty array for an item that has no comments', async () => {
    const fetchPage = makeFetchPage([]);
    const result = await fetchComments(REPO, [7], defaultConfig, () => {}, { fetchPage });

    expect(result.get(7)).toEqual([]);
  });

  it('respects maxCommentsPerItem and truncates early', async () => {
    // Simulate a page that returns more than the limit
    const manyComments = Array.from({ length: 10 }, (_, i) =>
      makeComment({ id: i + 1, body: `Comment ${i + 1}` }),
    );
    const fetchPage = makeFetchPage(manyComments);
    const config = {
      ...defaultConfig,
      github: { ...defaultConfig.github, maxCommentsPerItem: 3 },
    };

    const result = await fetchComments(REPO, [1], config, () => {}, { fetchPage });

    expect(result.get(1)).toHaveLength(3);
  });

  it('calls fetchPage with the correct comments URL', async () => {
    const fetchPage = makeFetchPage([]);
    await fetchComments(REPO, [42], defaultConfig, () => {}, { fetchPage });

    const firstCallUrl = (fetchPage as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(firstCallUrl).toContain('/repos/owner/repo/issues/42/comments');
  });

  it('fires the progressCallback once per item number', async () => {
    const fetchPage = makeFetchPage([makeComment({ id: 1 })]);
    const progress = vi.fn();

    await fetchComments(REPO, [1, 2, 3], defaultConfig, progress, { fetchPage });

    expect(progress).toHaveBeenCalledTimes(3);
  });

  it('fires progressCallback messages referencing the item number', async () => {
    const fetchPage = makeFetchPage([]);
    const messages: string[] = [];
    await fetchComments(REPO, [99], defaultConfig, (msg) => messages.push(msg), { fetchPage });

    expect(messages[0]).toContain('99');
  });

  it('handles multiple item numbers and keeps results separate', async () => {
    // Each call to fetchPage returns different comments depending on which URL was hit
    const fn = vi.fn();
    fn.mockImplementation(async (url: string) => {
      if (url.includes('/issues/1/comments')) {
        return { data: [makeComment({ id: 10, body: 'Issue 1 comment' })], nextUrl: null };
      }
      if (url.includes('/issues/2/comments')) {
        return { data: [makeComment({ id: 20, body: 'Issue 2 comment' })], nextUrl: null };
      }
      return { data: [], nextUrl: null };
    });

    const result = await fetchComments(REPO, [1, 2], defaultConfig, () => {}, { fetchPage: fn });

    expect(result.get(1)![0].body).toBe('Issue 1 comment');
    expect(result.get(2)![0].body).toBe('Issue 2 comment');
  });

  it('follows pagination for a single item until nextUrl is null', async () => {
    const fn = vi.fn();
    fn.mockResolvedValueOnce({
      data: [makeComment({ id: 1, body: 'Page 1' })],
      nextUrl: 'https://api.github.com/page2',
    });
    fn.mockResolvedValueOnce({
      data: [makeComment({ id: 2, body: 'Page 2' })],
      nextUrl: null,
    });

    const result = await fetchComments(REPO, [5], defaultConfig, () => {}, { fetchPage: fn });

    expect(result.get(5)).toHaveLength(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops paginating once maxCommentsPerItem is reached mid-pagination', async () => {
    const config = {
      ...defaultConfig,
      github: { ...defaultConfig.github, maxCommentsPerItem: 2 },
    };

    const fn = vi.fn();
    // Page 1 already satisfies the limit
    fn.mockResolvedValueOnce({
      data: [makeComment({ id: 1 }), makeComment({ id: 2 })],
      nextUrl: 'https://api.github.com/page2',
    });
    // Page 2 should never be fetched
    fn.mockResolvedValueOnce({
      data: [makeComment({ id: 3 })],
      nextUrl: null,
    });

    const result = await fetchComments(REPO, [5], config, () => {}, { fetchPage: fn });

    expect(result.get(5)).toHaveLength(2);
    expect(fn).toHaveBeenCalledTimes(1); // pagination stopped after page 1
  });
});