import { describe, it, expect } from 'vitest';
import {
  isReactionOnly,
  isBotUser,
  filterComments,
  filterIssues,
  filterPRs,
} from '../../../src/core/filter/noiseFilter.ts';
import { defaultConfig } from '../../../src/config/defaultConfig.ts';
import {
  FIXTURE_COMMENTS,
  FIXTURE_ISSUES,
  FIXTURE_PRS,
  makeComment,
  makeIssue,
} from '../../fixtures/githubFixtures.ts';

describe('isReactionOnly', () => {
  it('returns true for +1', () => expect(isReactionOnly('+1')).toBe(true));
  it('returns true for -1', () => expect(isReactionOnly('-1')).toBe(true));
  it('returns true for 👍', () => expect(isReactionOnly('👍')).toBe(true));
  it('returns true for 👎', () => expect(isReactionOnly('👎')).toBe(true));
  it('returns true for empty string', () => expect(isReactionOnly('')).toBe(true));
  it('returns true for null', () => expect(isReactionOnly(null)).toBe(true));
  it('returns true for whitespace only', () => expect(isReactionOnly('   ')).toBe(true));
  it('returns false for a real comment', () => expect(isReactionOnly('This is a real bug')).toBe(false));
  it('returns false for a comment starting with emoji but having text', () => {
    expect(isReactionOnly('🎉 Congratulations, this is fixed!')).toBe(false);
  });
});

describe('isBotUser', () => {
  const knownBots = defaultConfig.github.knownBots;

  it('returns true for dependabot[bot]', () => expect(isBotUser('dependabot[bot]', knownBots)).toBe(true));
  it('returns true for renovate[bot]', () => expect(isBotUser('renovate[bot]', knownBots)).toBe(true));
  it('returns true for any [bot] suffix', () => expect(isBotUser('my-custom-bot[bot]', knownBots)).toBe(true));
  it('returns false for a human user', () => expect(isBotUser('alice', knownBots)).toBe(false));
  it('returns false for null', () => expect(isBotUser(null, knownBots)).toBe(false));
  it('returns false for undefined', () => expect(isBotUser(undefined, knownBots)).toBe(false));
});

describe('filterComments', () => {
  it('removes reaction-only comments', () => {
    const result = filterComments(FIXTURE_COMMENTS, defaultConfig);
    const ids = result.map((c) => c.id);
    expect(ids).not.toContain(2); // 👍
    expect(ids).not.toContain(3); // +1
  });

  it('removes bot comments when ignoreBots=true', () => {
    const result = filterComments(FIXTURE_COMMENTS, defaultConfig);
    const ids = result.map((c) => c.id);
    expect(ids).not.toContain(4); // dependabot[bot]
  });

  it('keeps bot comments when ignoreBots=false', () => {
    const config = { ...defaultConfig, github: { ...defaultConfig.github, ignoreBots: false } };
    const result = filterComments(FIXTURE_COMMENTS, config);
    const ids = result.map((c) => c.id);
    expect(ids).toContain(4);
  });

  it('keeps real human comments', () => {
    const result = filterComments(FIXTURE_COMMENTS, defaultConfig);
    const ids = result.map((c) => c.id);
    expect(ids).toContain(1);
    expect(ids).toContain(5);
  });

  it('respects maxCommentsPerItem', () => {
    const comments = Array.from({ length: 20 }, (_, i) =>
      makeComment({ id: i + 1, body: `Comment ${i + 1}` }),
    );
    const config = { ...defaultConfig, github: { ...defaultConfig.github, maxCommentsPerItem: 5 } };
    const result = filterComments(comments, config);
    expect(result).toHaveLength(5);
  });
});

describe('filterIssues', () => {
  it('removes bot-authored issues', () => {
    const result = filterIssues(FIXTURE_ISSUES, defaultConfig);
    expect(result.some((i) => i.number === 5)).toBe(false); // dependabot issue
  });

  it('keeps human-authored issues', () => {
    const result = filterIssues(FIXTURE_ISSUES, defaultConfig);
    expect(result.some((i) => i.number === 1)).toBe(true);
  });

  it('keeps all issues when ignoreBots=false', () => {
    const config = { ...defaultConfig, github: { ...defaultConfig.github, ignoreBots: false } };
    const result = filterIssues(FIXTURE_ISSUES, config);
    expect(result).toHaveLength(FIXTURE_ISSUES.length);
  });

  it('handles issues with null user', () => {
    const issues = [makeIssue({ number: 99, user: null })];
    const result = filterIssues(issues, defaultConfig);
    expect(result).toHaveLength(1); // null user → keep (can't determine bot status)
  });
});

describe('filterPRs', () => {
  it('removes bot-authored PRs', () => {
    const result = filterPRs(FIXTURE_PRS, defaultConfig);
    expect(result.some((p) => p.number === 102)).toBe(false); // renovate[bot]
  });

  it('keeps human-authored PRs', () => {
    const result = filterPRs(FIXTURE_PRS, defaultConfig);
    expect(result.some((p) => p.number === 100)).toBe(true);
    expect(result.some((p) => p.number === 101)).toBe(true);
  });
});