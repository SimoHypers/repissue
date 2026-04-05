import { describe, it, expect } from 'vitest';
import { generateOutput } from '../../../src/core/output/outputGenerate.ts';
import { defaultConfig } from '../../../src/config/defaultConfig.ts';
import type { OutputContext } from '../../../src/core/output/outputGeneratorTypes.ts';
import { makeIssue, makePR, makeComment, makeLabel } from '../../fixtures/githubFixtures.ts';

const makeContext = (overrides: Partial<OutputContext> = {}): OutputContext => ({
  repo: 'owner/repo',
  generatedAt: '2026-04-04T10:00:00.000Z',
  issues: [
    {
      issue: makeIssue({ number: 1, title: 'Bug: crash on login', labels: [makeLabel('bug')] }),
      comments: [makeComment({ body: 'Confirmed reproducible.' })],
      filteredCommentCount: 2,
      crossRefs: { closes: [], mentions: [5] },
    },
  ],
  prs: [
    {
      pr: makePR({ number: 100, title: 'Fix login crash', body: 'This closes #1.' }),
      comments: [],
      filteredCommentCount: 0,
      crossRefs: { closes: [1], mentions: [] },
    },
  ],
  config: defaultConfig,
  ...overrides,
});

describe('generateOutput — markdown', () => {
  it('includes the repo name', () => {
    const output = generateOutput(makeContext());
    expect(output).toContain('owner/repo');
  });

  it('includes issue title', () => {
    const output = generateOutput(makeContext());
    expect(output).toContain('Bug: crash on login');
  });

  it('includes PR title', () => {
    const output = generateOutput(makeContext());
    expect(output).toContain('Fix login crash');
  });

  it('renders label badges', () => {
    const output = generateOutput(makeContext());
    // Labels are now rendered as: ⚠️ `bug`
    expect(output).toContain('`bug`');
  });

  it('renders cross-reference mentions', () => {
    const output = generateOutput(makeContext());
    expect(output).toContain('#5');
  });

  it('renders closes cross-reference on PR', () => {
    const output = generateOutput(makeContext());
    expect(output).toContain('#1');
  });

  it('includes comment body', () => {
    const output = generateOutput(makeContext());
    expect(output).toContain('Confirmed reproducible.');
  });

  it('shows filtered comment count', () => {
    const output = generateOutput(makeContext());
    // Wording is now "2 filtered" (without "as noise" suffix)
    expect(output).toContain('2 filtered');
  });

  it('renders the generated date', () => {
    const output = generateOutput(makeContext());
    expect(output).toContain('2026-04-04');
  });

  it('includes custom headerText when provided', () => {
    const context = makeContext({
      config: {
        ...defaultConfig,
        output: { ...defaultConfig.output, headerText: 'Custom header message' },
      },
    });
    const output = generateOutput(context);
    expect(output).toContain('Custom header message');
  });
});

describe('generateOutput — plain', () => {
  const plainConfig = { ...defaultConfig, output: { ...defaultConfig.output, style: 'plain' as const } };

  it('renders issue title without markdown formatting', () => {
    const output = generateOutput(makeContext({ config: plainConfig }));
    expect(output).toContain('Bug: crash on login');
    // Plain text should not have ## headers
    expect(output).not.toContain('## Open Issues');
  });

  it('renders PR title', () => {
    const output = generateOutput(makeContext({ config: plainConfig }));
    expect(output).toContain('Fix login crash');
  });
});

describe('generateOutput — xml', () => {
  const xmlConfig = { ...defaultConfig, output: { ...defaultConfig.output, style: 'xml' as const } };

  it('produces valid XML structure', () => {
    const output = generateOutput(makeContext({ config: xmlConfig }));
    expect(output).toContain('<?xml version="1.0"');
    expect(output).toContain('<repissue>');
    expect(output).toContain('</repissue>');
  });

  it('includes issue in XML', () => {
    const output = generateOutput(makeContext({ config: xmlConfig }));
    expect(output).toContain('<issue number="1">');
  });

  it('includes PR in XML', () => {
    const output = generateOutput(makeContext({ config: xmlConfig }));
    expect(output).toContain('<pull_request number="100">');
  });

  it('escapes XML special characters in body', () => {
    const context = makeContext({
      config: xmlConfig,
      issues: [
        {
          issue: makeIssue({ body: 'Use <br> & "quotes" here' }),
          comments: [],
          filteredCommentCount: 0,
          crossRefs: { closes: [], mentions: [] },
        },
      ],
    });
    const output = generateOutput(context);
    expect(output).toContain('&lt;br&gt;');
    expect(output).toContain('&amp;');
    expect(output).toContain('&quot;');
  });
});

describe('generateOutput — empty state', () => {
  it('handles zero issues and zero PRs gracefully', () => {
    const context = makeContext({ issues: [], prs: [] });
    const output = generateOutput(context);
    expect(output).toContain('owner/repo');
    expect(output).not.toContain('undefined');
    expect(output).not.toContain('[object Object]');
  });
});