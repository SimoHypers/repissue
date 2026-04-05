import { describe, it, expect } from 'vitest';
import { parseCrossRefs, parseCrossRefsFromThread } from '../../../src/core/github/crossRefParse';

describe('parseCrossRefs', () => {
  it('returns empty arrays for null body', () => {
    const result = parseCrossRefs(null);
    expect(result.closes).toEqual([]);
    expect(result.mentions).toEqual([]);
  });

  it('returns empty arrays for body with no references', () => {
    const result = parseCrossRefs('This is a plain description.');
    expect(result.closes).toEqual([]);
    expect(result.mentions).toEqual([]);
  });

  it('detects "closes #N"', () => {
    expect(parseCrossRefs('closes #42').closes).toContain(42);
  });

  it('detects "Closes #N" (case-insensitive)', () => {
    expect(parseCrossRefs('Closes #42').closes).toContain(42);
  });

  it('detects "FIXES #N"', () => {
    expect(parseCrossRefs('FIXES #7').closes).toContain(7);
  });

  it('detects "resolves #N"', () => {
    expect(parseCrossRefs('resolves #100').closes).toContain(100);
  });

  it('detects "fix #N"', () => {
    expect(parseCrossRefs('fix #5').closes).toContain(5);
  });

  it('detects "close #N"', () => {
    expect(parseCrossRefs('close #3').closes).toContain(3);
  });

  it('detects "resolve #N"', () => {
    expect(parseCrossRefs('resolve #8').closes).toContain(8);
  });

  it('detects multiple closing references', () => {
    const result = parseCrossRefs('This fixes #1 and closes #2.');
    expect(result.closes).toContain(1);
    expect(result.closes).toContain(2);
  });

  it('deduplicates repeated references', () => {
    const result = parseCrossRefs('fixes #42 and also fixes #42');
    expect(result.closes.filter((n) => n === 42)).toHaveLength(1);
  });

  it('puts bare #N mentions in mentions (not closes)', () => {
    const result = parseCrossRefs('See #10 for context.');
    expect(result.mentions).toContain(10);
    expect(result.closes).not.toContain(10);
  });

  it('does not double-count a number in both closes and mentions', () => {
    const result = parseCrossRefs('fixes #42. Also see #42.');
    expect(result.closes).toContain(42);
    expect(result.mentions).not.toContain(42);
  });

  it('handles cross-repo references like owner/repo#42', () => {
    const result = parseCrossRefs('fixes owner/repo#42');
    expect(result.closes).toContain(42);
  });
});

describe('parseCrossRefsFromThread', () => {
  it('merges closes from body and comments', () => {
    const result = parseCrossRefsFromThread('fixes #1', ['closes #2', null]);
    expect(result.closes).toContain(1);
    expect(result.closes).toContain(2);
  });

  it('merges mentions from body and comments', () => {
    const result = parseCrossRefsFromThread('See #5', ['Related to #6']);
    expect(result.mentions).toContain(5);
    expect(result.mentions).toContain(6);
  });

  it('handles null body', () => {
    const result = parseCrossRefsFromThread(null, ['fixes #3']);
    expect(result.closes).toContain(3);
  });

  it('promotes mention to closes if a comment closes the same number', () => {
    const result = parseCrossRefsFromThread('See #10', ['fixes #10']);
    expect(result.closes).toContain(10);
    expect(result.mentions).not.toContain(10);
  });

  it('returns sorted arrays', () => {
    const result = parseCrossRefsFromThread('fixes #5 fixes #2 fixes #8', []);
    expect(result.closes).toEqual([2, 5, 8]);
  });
});