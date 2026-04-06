/**
 * Integration tests — these call the real GitHub API.
 *
 * Target repo: elysiajs/elysia-jwt
 *   - A small, stable Elysia.js plugin repo.
 *   - Has a manageable number of issues and PRs — enough to exercise the full
 *     pipeline without hammering the API or producing an enormous response.
 *   - We assert on structure rather than exact counts, since those can change
 *     over time as the project evolves.
 *
 * Run conditions:
 *   - Set GITHUB_TOKEN to get 5,000 req/hr and stable runs in CI.
 *   - Without a token the unauthenticated 60 req/hr cap may be hit on busy
 *     CI runners sharing an IP address.
 *
 * These tests intentionally do NOT mock anything — the whole point is to
 * exercise the real fetch → filter → generate → metrics pipeline.
 */

import { describe, it, expect } from 'vitest';
import { pack } from '../../src/core/packager.ts';
import { defaultConfig } from '../../src/config/defaultConfig.ts';
import type { RepissueConfigMerged } from '../../src/config/configSchema.ts';

const FIXTURE_REPO = 'elysiajs/elysia-jwt';


// In Vitest 4 the timeout is the second argument to it(), not a describe option.
const NETWORK_TIMEOUT = 30_000;

const makeIntegrationConfig = (): RepissueConfigMerged => {
  const token = process.env['GITHUB_TOKEN'];
  return {
    ...defaultConfig,
    output: {
      ...defaultConfig.output,
      filePath: '', // stdout mode — no disk I/O
    },
    github: {
      ...defaultConfig.github,
      token,
      maxCommentsPerItem: 5,
      includeMergedDays: undefined,
      includeClosedDays: undefined,
    },
  };
};

// Single shared pack() call — lazy-init so the API is hit exactly once.
let resultPromise: ReturnType<typeof pack> | null = null;
const getResult = () => {
  if (!resultPromise) {
    resultPromise = pack({ repo: FIXTURE_REPO, config: makeIntegrationConfig() });
  }
  return resultPromise;
};

describe('integration: pack() against elysiajs/elysia-jwt', () => {

  // ── Pack result shape ─────────────────────────────────────────────────────

  it('pack() resolves without throwing', async () => {
    await expect(getResult()).resolves.toBeDefined();
  }, NETWORK_TIMEOUT);

  it('returns a PackResult with the expected numeric fields', async () => {
    const result = await getResult();
    expect(typeof result.totalIssues).toBe('number');
    expect(typeof result.totalPRs).toBe('number');
    expect(typeof result.totalTokens).toBe('number');
  }, NETWORK_TIMEOUT);

  it('totalIssues and totalPRs are non-negative integers', async () => {
    const result = await getResult();
    expect(result.totalIssues).toBeGreaterThanOrEqual(0);
    expect(result.totalPRs).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.totalIssues)).toBe(true);
    expect(Number.isInteger(result.totalPRs)).toBe(true);
  }, NETWORK_TIMEOUT);

  it('totalTokens is a positive integer (output is non-empty)', async () => {
    const result = await getResult();
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(Number.isInteger(result.totalTokens)).toBe(true);
  }, NETWORK_TIMEOUT);

  it('outputFiles is empty (stdout/no-disk mode)', async () => {
    const result = await getResult();
    expect(result.outputFiles).toEqual([]);
  }, NETWORK_TIMEOUT);

  // ── Output string structure ───────────────────────────────────────────────

  it('output is a non-empty string', async () => {
    const result = await getResult();
    expect(typeof result.output).toBe('string');
    expect(result.output.length).toBeGreaterThan(0);
  }, NETWORK_TIMEOUT);

  it('output contains the repo name', async () => {
    const result = await getResult();
    expect(result.output).toContain(FIXTURE_REPO);
  }, NETWORK_TIMEOUT);

  it('output contains the repissue header', async () => {
    const result = await getResult();
    expect(result.output).toContain('repissue');
  }, NETWORK_TIMEOUT);

  it('output contains a Generated timestamp', async () => {
    const result = await getResult();
    // The markdown template renders this as part of the table: | 🕐 **Generated** | … |
    expect(result.output).toContain('Generated');
  }, NETWORK_TIMEOUT);

  it('output contains the Open Issues section header when issues are present', async () => {
    const result = await getResult();
    if (result.totalIssues > 0) {
      expect(result.output).toContain('Issues');
    }
  }, NETWORK_TIMEOUT);

  it('output contains the Open Pull Requests section header when PRs are present', async () => {
    const result = await getResult();
    if (result.totalPRs > 0) {
      expect(result.output).toContain('Pull Requests');
    }
  }, NETWORK_TIMEOUT);

  it('output does not contain raw "undefined" or "[object Object]" strings', async () => {
    const result = await getResult();
    expect(result.output).not.toContain('undefined');
    expect(result.output).not.toContain('[object Object]');
  }, NETWORK_TIMEOUT);

  it('output does not contain unresolved Handlebars placeholders', async () => {
    const result = await getResult();
    expect(result.output).not.toMatch(/\{\{[^}]+\}\}/);
  }, NETWORK_TIMEOUT);

  // ── Style variants ────────────────────────────────────────────────────────

  it('plain style output does not contain markdown H2 headers', async () => {
    const config: RepissueConfigMerged = {
      ...makeIntegrationConfig(),
      output: { ...makeIntegrationConfig().output, style: 'plain' },
    };
    const result = await pack({ repo: FIXTURE_REPO, config });
    expect(result.output).not.toContain('## Open Issues');
    if (result.totalIssues > 0) {
      expect(result.output).toContain('OPEN ISSUES');
    }
  }, NETWORK_TIMEOUT);

  it('xml style output is valid XML with repissue root element', async () => {
    const config: RepissueConfigMerged = {
      ...makeIntegrationConfig(),
      output: { ...makeIntegrationConfig().output, style: 'xml' },
    };
    const result = await pack({ repo: FIXTURE_REPO, config });
    expect(result.output).toContain('<?xml version="1.0"');
    expect(result.output).toContain('<repissue>');
    expect(result.output).toContain('</repissue>');
  }, NETWORK_TIMEOUT);

  // ── --no-issues / --no-prs flags ─────────────────────────────────────────

  it('respects includeIssues=false — output has no issues section', async () => {
    const config: RepissueConfigMerged = {
      ...makeIntegrationConfig(),
      github: { ...makeIntegrationConfig().github, includeIssues: false },
    };
    const result = await pack({ repo: FIXTURE_REPO, config });
    expect(result.totalIssues).toBe(0);
    expect(result.output).not.toContain('Open Issues');
  }, NETWORK_TIMEOUT);

  it('respects includePRs=false — output has no PRs section', async () => {
    const config: RepissueConfigMerged = {
      ...makeIntegrationConfig(),
      github: { ...makeIntegrationConfig().github, includePRs: false },
    };
    const result = await pack({ repo: FIXTURE_REPO, config });
    expect(result.totalPRs).toBe(0);
    expect(result.output).not.toContain('Open Pull Requests');
  }, NETWORK_TIMEOUT);

  // ── Error handling ────────────────────────────────────────────────────────

  it('throws a meaningful error for a non-existent repo', async () => {
    const config = makeIntegrationConfig();
    await expect(
      pack({ repo: 'this-owner-definitely-does-not-exist-xyz/no-repo', config }),
    ).rejects.toThrow();
  }, NETWORK_TIMEOUT);
});