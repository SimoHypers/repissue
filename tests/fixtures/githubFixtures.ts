import type { GitHubIssue, GitHubPR, GitHubComment } from '../../src/core/github/githubTypes.ts';

export const makeUser = (login: string, type = 'User') => ({ login, type });

export const makeLabel = (name: string, color = 'ff0000') => ({ name, color });

export const makeIssue = (overrides: Partial<GitHubIssue> = {}): GitHubIssue => ({
  number: 1,
  title: 'Test issue',
  body: 'This is the body of the issue.',
  state: 'open',
  labels: [],
  user: makeUser('alice'),
  comments: 0,
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-02T10:00:00Z',
  closed_at: null,
  html_url: 'https://github.com/owner/repo/issues/1',
  ...overrides,
});

export const makePR = (overrides: Partial<GitHubPR> = {}): GitHubPR => ({
  number: 100,
  title: 'Test PR',
  body: 'This PR closes #1.',
  state: 'open',
  draft: false,
  labels: [],
  user: makeUser('bob'),
  base: { ref: 'main' },
  head: { ref: 'feature/test' },
  additions: 10,
  deletions: 5,
  changed_files: 2,
  merged_at: null,
  created_at: '2026-01-03T10:00:00Z',
  updated_at: '2026-01-04T10:00:00Z',
  html_url: 'https://github.com/owner/repo/pull/100',
  ...overrides,
});

export const makeComment = (overrides: Partial<GitHubComment> = {}): GitHubComment => ({
  id: 1,
  body: 'This is a helpful comment.',
  user: makeUser('charlie'),
  created_at: '2026-01-02T12:00:00Z',
  ...overrides,
});

// A collection of fixture issues covering various scenarios
export const FIXTURE_ISSUES: GitHubIssue[] = [
  makeIssue({ number: 1, title: 'Bug: crash on login', labels: [makeLabel('bug')], comments: 5 }),
  makeIssue({ number: 2, title: 'Security: token leak', labels: [makeLabel('security')], comments: 3 }),
  makeIssue({ number: 3, title: 'P0: data loss', labels: [makeLabel('P0')], comments: 10 }),
  makeIssue({ number: 4, title: 'Feature request', labels: [], comments: 1 }),
  makeIssue({
    number: 5,
    title: 'Bot noise issue',
    labels: [],
    comments: 0,
    user: makeUser('dependabot[bot]', 'Bot'),
  }),
];

export const FIXTURE_PRS: GitHubPR[] = [
  makePR({ number: 100, title: 'Fix login crash', labels: [makeLabel('bug')], draft: false }),
  makePR({ number: 101, title: 'WIP: refactor auth', labels: [], draft: true }),
  makePR({
    number: 102,
    title: 'Renovate deps',
    labels: [],
    user: makeUser('renovate[bot]', 'Bot'),
  }),
];

export const FIXTURE_COMMENTS: GitHubComment[] = [
  makeComment({ id: 1, body: 'Confirmed. This is a real bug.', user: makeUser('alice') }),
  makeComment({ id: 2, body: '👍', user: makeUser('dave') }), // reaction-only — should be filtered
  makeComment({ id: 3, body: '+1', user: makeUser('eve') }),   // reaction-only — should be filtered
  makeComment({ id: 4, body: 'Fixed in PR #100', user: makeUser('dependabot[bot]', 'Bot') }), // bot
  makeComment({ id: 5, body: 'Thanks for the report!', user: makeUser('carol') }),
];