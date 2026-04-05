import { describe, it, expect } from 'vitest';
import { buildHeaders, buildUrl } from '../../../src/core/github/githubClient.ts';

// ── buildHeaders ────────────────────────────────────────────────────────────

describe('buildHeaders', () => {
  it('always includes Accept and X-GitHub-Api-Version', () => {
    const headers = buildHeaders();
    expect(headers['Accept']).toBe('application/vnd.github+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('adds Authorization header when token is provided', () => {
    const headers = buildHeaders('ghp_test123');
    expect(headers['Authorization']).toBe('Bearer ghp_test123');
  });

  it('omits Authorization header when token is undefined', () => {
    const headers = buildHeaders(undefined);
    expect(headers['Authorization']).toBeUndefined();
  });

  it('omits Authorization header when called with no arguments', () => {
    const headers = buildHeaders();
    expect(headers['Authorization']).toBeUndefined();
  });
});

// ── buildUrl ────────────────────────────────────────────────────────────────

describe('buildUrl', () => {
  it('builds a full URL from a path', () => {
    const url = buildUrl('/repos/owner/repo/issues');
    expect(url).toContain('https://api.github.com/repos/owner/repo/issues');
  });

  it('always includes per_page=100', () => {
    const url = buildUrl('/repos/owner/repo/issues');
    expect(url).toContain('per_page=100');
  });

  it('appends extra query params', () => {
    const url = buildUrl('/repos/owner/repo/issues', { state: 'open' });
    expect(url).toContain('state=open');
  });

  it('appends multiple extra params', () => {
    const url = buildUrl('/repos/owner/repo/pulls', { state: 'open', direction: 'desc' });
    expect(url).toContain('state=open');
    expect(url).toContain('direction=desc');
  });

  it('produces a valid URL string', () => {
    const url = buildUrl('/repos/owner/repo/issues');
    expect(() => new URL(url)).not.toThrow();
  });
});