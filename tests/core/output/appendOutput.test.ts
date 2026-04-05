import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  resolveAppendStyle,
  generateAppendBlock,
  appendToFile,
} from '../../../src/core/output/appendOutput.ts';
import { defaultConfig } from '../../../src/config/defaultConfig.ts';
import { makeIssue, makePR, makeComment, makeLabel } from '../../fixtures/githubFixtures.ts';
import type { OutputContext } from '../../../src/core/output/outputGeneratorTypes.ts';

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── resolveAppendStyle ─────────────────────────────────────────────────────

describe('resolveAppendStyle', () => {
  it('returns the explicit style when provided, regardless of extension', () => {
    expect(resolveAppendStyle('output.xml', 'plain')).toBe('plain');
    expect(resolveAppendStyle('output.md', 'xml')).toBe('xml');
    expect(resolveAppendStyle('output.txt', 'markdown')).toBe('markdown');
  });

  it('infers xml from .xml extension when no explicit style given', () => {
    expect(resolveAppendStyle('repomix-output.xml')).toBe('xml');
    expect(resolveAppendStyle('/some/path/output.XML')).toBe('xml');
  });

  it('infers markdown from .md extension', () => {
    expect(resolveAppendStyle('output.md')).toBe('markdown');
  });

  it('defaults to markdown for unknown extensions', () => {
    expect(resolveAppendStyle('output.txt')).toBe('markdown');
    expect(resolveAppendStyle('output')).toBe('markdown');
    expect(resolveAppendStyle('output.json')).toBe('markdown');
  });
});

// ── generateAppendBlock ────────────────────────────────────────────────────

describe('generateAppendBlock — markdown', () => {
  it('includes the repo name', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).toContain('owner/repo');
  });

  it('includes issue title', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).toContain('Bug: crash on login');
  });

  it('includes PR title', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).toContain('Fix login crash');
  });

  it('renders label badges', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).toContain('[bug]');
  });

  it('includes cross-reference mentions', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).toContain('#5');
  });

  it('includes comment body', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).toContain('Confirmed reproducible.');
  });

  it('shows filtered comment count', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).toContain('2 filtered as noise');
  });

  it('does NOT include the full repissue file header', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    // The full output starts with "# repissue Output" — append block should not
    expect(block).not.toContain('# repissue Output');
  });

  it('does not contain unresolved Handlebars placeholders', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('does not contain "undefined" or "[object Object]"', () => {
    const block = generateAppendBlock(makeContext(), 'markdown');
    expect(block).not.toContain('undefined');
    expect(block).not.toContain('[object Object]');
  });

  it('handles zero issues and zero PRs gracefully', () => {
    const block = generateAppendBlock(makeContext({ issues: [], prs: [] }), 'markdown');
    expect(block).toContain('owner/repo');
    expect(block).not.toContain('undefined');
  });
});

describe('generateAppendBlock — plain', () => {
  it('renders issue title', () => {
    const block = generateAppendBlock(makeContext(), 'plain');
    expect(block).toContain('Bug: crash on login');
  });

  it('does not contain markdown headers', () => {
    const block = generateAppendBlock(makeContext(), 'plain');
    expect(block).not.toContain('## ');
    expect(block).not.toContain('### ');
  });

  it('renders the OPEN ISSUES section label', () => {
    const block = generateAppendBlock(makeContext(), 'plain');
    expect(block).toContain('OPEN ISSUES');
  });
});

describe('generateAppendBlock — xml', () => {
  it('produces a repissue_append wrapper element', () => {
    const block = generateAppendBlock(makeContext(), 'xml');
    expect(block).toContain('<repissue_append>');
    expect(block).toContain('</repissue_append>');
  });

  it('includes the issue number as an attribute', () => {
    const block = generateAppendBlock(makeContext(), 'xml');
    expect(block).toContain('<issue number="1">');
  });

  it('includes the PR number as an attribute', () => {
    const block = generateAppendBlock(makeContext(), 'xml');
    expect(block).toContain('<pull_request number="100">');
  });

  it('escapes XML special characters in titles', () => {
    const ctx = makeContext({
      issues: [
        {
          issue: makeIssue({ title: 'Use <br> & "quotes"', body: null }),
          comments: [],
          filteredCommentCount: 0,
          crossRefs: { closes: [], mentions: [] },
        },
      ],
    });
    const block = generateAppendBlock(ctx, 'xml');
    expect(block).toContain('&lt;br&gt;');
    expect(block).toContain('&amp;');
    expect(block).toContain('&quot;');
  });

  it('does not include <?xml declaration (it is a fragment, not a full document)', () => {
    const block = generateAppendBlock(makeContext(), 'xml');
    expect(block).not.toContain('<?xml');
  });
});

// ── appendToFile ───────────────────────────────────────────────────────────

describe('appendToFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'repissue-append-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws RepissueError when the target file does not exist', async () => {
    const nonExistent = path.join(tmpDir, 'does-not-exist.md');
    await expect(
      appendToFile(nonExistent, makeContext(), 'markdown'),
    ).rejects.toThrow('does not exist');
  });

  it('appends markdown block to an existing markdown file', async () => {
    const target = path.join(tmpDir, 'output.md');
    await writeFile(target, '# Existing content\n', 'utf-8');

    await appendToFile(target, makeContext(), 'markdown');

    const result = await readFile(target, 'utf-8');
    expect(result).toContain('# Existing content');
    expect(result).toContain('Bug: crash on login');
  });

  it('preserves all existing content when appending', async () => {
    const originalContent = '# My Repomix Output\n\nSome important code context here.\n';
    const target = path.join(tmpDir, 'output.md');
    await writeFile(target, originalContent, 'utf-8');

    await appendToFile(target, makeContext(), 'markdown');

    const result = await readFile(target, 'utf-8');
    expect(result.startsWith(originalContent)).toBe(true);
  });

  it('appends plain block to an existing plain text file', async () => {
    const target = path.join(tmpDir, 'output.txt');
    await writeFile(target, 'Existing plain text content\n', 'utf-8');

    await appendToFile(target, makeContext(), 'plain');

    const result = await readFile(target, 'utf-8');
    expect(result).toContain('Existing plain text content');
    expect(result).toContain('OPEN ISSUES');
  });

  it('inserts xml block before the closing root tag', async () => {
    const target = path.join(tmpDir, 'output.xml');
    const existingXml = '<?xml version="1.0"?>\n<repomix>\n  <files/>\n</repomix>\n';
    await writeFile(target, existingXml, 'utf-8');

    await appendToFile(target, makeContext(), 'xml');

    const result = await readFile(target, 'utf-8');
    // The append block should appear before </repomix>
    const appendIndex = result.indexOf('<repissue_append>');
    const closingIndex = result.indexOf('</repomix>');
    expect(appendIndex).toBeGreaterThan(-1);
    expect(closingIndex).toBeGreaterThan(-1);
    expect(appendIndex).toBeLessThan(closingIndex);
  });

  it('falls back to plain append for xml files with no closing root tag', async () => {
    const target = path.join(tmpDir, 'output.xml');
    // Deliberately malformed — no closing tag at end, so the heuristic cannot find one
    await writeFile(target, '<?xml version="1.0"?>\n<!-- no closing root tag here', 'utf-8');

    // Should not throw
    await expect(appendToFile(target, makeContext(), 'xml')).resolves.toBeUndefined();

    const result = await readFile(target, 'utf-8');
    expect(result).toContain('<repissue_append>');
  });

  it('handles existing file that does not end with a newline', async () => {
    const target = path.join(tmpDir, 'output.md');
    await writeFile(target, '# No trailing newline', 'utf-8'); // deliberately no \n

    await appendToFile(target, makeContext(), 'markdown');

    const result = await readFile(target, 'utf-8');
    // Should not have a double blank line or missing separator
    expect(result).toContain('# No trailing newline');
    expect(result).toContain('owner/repo');
  });

  it('appended content contains issue and PR data', async () => {
    const target = path.join(tmpDir, 'output.md');
    await writeFile(target, '# Base\n', 'utf-8');

    await appendToFile(target, makeContext(), 'markdown');

    const result = await readFile(target, 'utf-8');
    expect(result).toContain('Bug: crash on login');
    expect(result).toContain('Fix login crash');
  });
});