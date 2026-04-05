import { describe, it, expect } from 'vitest';
import { computeLabelScore, sortIssuesByPriority, sortPRsByPriority } from '../../../src/core/filter/labelSort.ts';
import { makeIssue, makePR, makeLabel } from '../../fixtures/githubFixtures.ts';

const LABEL_PRIORITY = ['bug', 'security', 'P0'];

describe('computeLabelScore', () => {
  it('returns 0 for no labels', () => {
    expect(computeLabelScore([], LABEL_PRIORITY)).toBe(0);
  });

  it('returns 0 for labels not in priority list', () => {
    expect(computeLabelScore([makeLabel('enhancement')], LABEL_PRIORITY)).toBe(0);
  });

  it('scores first label in priority list highest', () => {
    const bugScore = computeLabelScore([makeLabel('bug')], LABEL_PRIORITY);
    const securityScore = computeLabelScore([makeLabel('security')], LABEL_PRIORITY);
    const p0Score = computeLabelScore([makeLabel('P0')], LABEL_PRIORITY);
    expect(bugScore).toBeGreaterThan(securityScore);
    expect(securityScore).toBeGreaterThan(p0Score);
    expect(p0Score).toBeGreaterThan(0);
  });

  it('picks the best score when multiple priority labels are present', () => {
    const bugAndP0 = computeLabelScore([makeLabel('P0'), makeLabel('bug')], LABEL_PRIORITY);
    const bugOnly = computeLabelScore([makeLabel('bug')], LABEL_PRIORITY);
    expect(bugAndP0).toBe(bugOnly); // bug is highest regardless of P0
  });
});

describe('sortIssuesByPriority', () => {
  it('floats bug-labelled issues to the top', () => {
    const issues = [
      makeIssue({ number: 1, title: 'Plain', labels: [], comments: 0 }),
      makeIssue({ number: 2, title: 'Bug', labels: [makeLabel('bug')], comments: 0 }),
    ];
    const sorted = sortIssuesByPriority(issues, LABEL_PRIORITY);
    expect(sorted[0].number).toBe(2);
  });

  it('sorts by comment count when labels are equal', () => {
    const issues = [
      makeIssue({ number: 1, labels: [makeLabel('bug')], comments: 2 }),
      makeIssue({ number: 2, labels: [makeLabel('bug')], comments: 10 }),
    ];
    const sorted = sortIssuesByPriority(issues, LABEL_PRIORITY);
    expect(sorted[0].number).toBe(2); // more comments = first
  });

  it('sorts by created_at ascending as final tiebreaker', () => {
    const issues = [
      makeIssue({ number: 1, labels: [], comments: 0, created_at: '2026-02-01T00:00:00Z' }),
      makeIssue({ number: 2, labels: [], comments: 0, created_at: '2026-01-01T00:00:00Z' }),
    ];
    const sorted = sortIssuesByPriority(issues, LABEL_PRIORITY);
    expect(sorted[0].number).toBe(2); // older issue first
  });

  it('does not mutate the original array', () => {
    const issues = [
      makeIssue({ number: 1, labels: [] }),
      makeIssue({ number: 2, labels: [makeLabel('bug')] }),
    ];
    const original = [...issues];
    sortIssuesByPriority(issues, LABEL_PRIORITY);
    expect(issues[0].number).toBe(original[0].number);
  });
});

describe('sortPRsByPriority', () => {
  it('puts non-draft PRs before draft PRs at equal priority', () => {
    const prs = [
      makePR({ number: 1, draft: true, labels: [] }),
      makePR({ number: 2, draft: false, labels: [] }),
    ];
    const sorted = sortPRsByPriority(prs, LABEL_PRIORITY);
    expect(sorted[0].number).toBe(2);
  });

  it('floats labelled PRs above draft PRs', () => {
    const prs = [
      makePR({ number: 1, draft: false, labels: [] }),
      makePR({ number: 2, draft: true, labels: [makeLabel('bug')] }),
    ];
    const sorted = sortPRsByPriority(prs, LABEL_PRIORITY);
    expect(sorted[0].number).toBe(2); // labelled draft beats unlabelled non-draft
  });

  it('sorts by updated_at descending as tiebreaker', () => {
    const prs = [
      makePR({ number: 1, draft: false, labels: [], updated_at: '2026-01-01T00:00:00Z' }),
      makePR({ number: 2, draft: false, labels: [], updated_at: '2026-03-01T00:00:00Z' }),
    ];
    const sorted = sortPRsByPriority(prs, LABEL_PRIORITY);
    expect(sorted[0].number).toBe(2); // more recently updated first
  });
});