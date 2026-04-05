import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildSplitFilePath,
  splitIntoChunks,
  writeSplitFiles,
} from '../../../src/core/output/splitOutput.ts';
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
      filteredCommentCount: 0,
      crossRefs: { closes: [], mentions: [] },
    },
    {
      issue: makeIssue({ number: 2, title: 'Security: token leak', labels: [makeLabel('security')] }),
      comments: [],
      filteredCommentCount: 0,
      crossRefs: { closes: [], mentions: [] },
    },
    {
      issue: makeIssue({ number: 3, title: 'P0: data loss', labels: [makeLabel('P0')] }),
      comments: [],
      filteredCommentCount: 0,
      crossRefs: { closes: [], mentions: [] },
    },
  ],
  prs: [
    {
      pr: makePR({ number: 100, title: 'Fix login crash' }),
      comments: [],
      filteredCommentCount: 0,
      crossRefs: { closes: [1], mentions: [] },
    },
    {
      pr: makePR({ number: 101, title: 'Patch token leak' }),
      comments: [],
      filteredCommentCount: 0,
      crossRefs: { closes: [2], mentions: [] },
    },
  ],
  config: defaultConfig,
  ...overrides,
});

// ── buildSplitFilePath ─────────────────────────────────────────────────────

describe('buildSplitFilePath', () => {
  it('inserts the index before the extension', () => {
    expect(buildSplitFilePath('repissue-output.md', 1)).toBe('repissue-output-1.md');
    expect(buildSplitFilePath('repissue-output.md', 2)).toBe('repissue-output-2.md');
  });

  it('handles .xml extension', () => {
    expect(buildSplitFilePath('output.xml', 3)).toBe('output-3.xml');
  });

  it('handles paths with directories', () => {
    expect(buildSplitFilePath('/some/dir/output.md', 1)).toBe('/some/dir/output-1.md');
  });

  it('handles files with no extension', () => {
    expect(buildSplitFilePath('output', 2)).toBe('output-2');
  });

  it('handles filenames with multiple dots', () => {
    expect(buildSplitFilePath('my.output.file.md', 1)).toBe('my.output.file-1.md');
  });
});

// ── splitIntoChunks ────────────────────────────────────────────────────────

describe('splitIntoChunks — no split needed', () => {
  it('returns a single chunk when maxBytes is very large', () => {
    const chunks = splitIntoChunks(makeContext(), 10_000_000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(1);
  });

  it('single chunk contains both issues and PRs', () => {
    const chunks = splitIntoChunks(makeContext(), 10_000_000);
    expect(chunks[0].content).toContain('Bug: crash on login');
    expect(chunks[0].content).toContain('Fix login crash');
  });

  it('returns a single chunk for an empty context', () => {
    const chunks = splitIntoChunks(makeContext({ issues: [], prs: [] }), 10_000_000);
    expect(chunks).toHaveLength(1);
  });
});

describe('splitIntoChunks — splitting occurs', () => {
  it('produces multiple chunks when maxBytes is small', () => {
    // Each item is well over 50 bytes, so this forces splitting
    const chunks = splitIntoChunks(makeContext(), 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('chunk indices are 1-based and sequential', () => {
    const chunks = splitIntoChunks(makeContext(), 50);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i + 1);
    });
  });

  it('every item appears in exactly one chunk', () => {
    const chunks = splitIntoChunks(makeContext(), 300);
    const allContent = chunks.map((c) => c.content).join('');

    // All issue titles present
    expect(allContent).toContain('Bug: crash on login');
    expect(allContent).toContain('Security: token leak');
    expect(allContent).toContain('P0: data loss');
    // All PR titles present
    expect(allContent).toContain('Fix login crash');
    expect(allContent).toContain('Patch token leak');
  });

  it('no single issue title appears in more than one chunk', () => {
    const chunks = splitIntoChunks(makeContext(), 300);
    const title = 'Bug: crash on login';
    const chunksWithTitle = chunks.filter((c) => c.content.includes(title));
    expect(chunksWithTitle).toHaveLength(1);
  });

  it('each chunk has its own preamble with repo name', () => {
    const chunks = splitIntoChunks(makeContext(), 50);
    for (const chunk of chunks) {
      expect(chunk.content).toContain('owner/repo');
    }
  });

  it('preamble shows correct Part N of M', () => {
    const chunks = splitIntoChunks(makeContext(), 50);
    const total = chunks.length;
    expect(chunks[0].content).toContain(`Part 1 of ${total}`);
    expect(chunks[total - 1].content).toContain(`Part ${total} of ${total}`);
  });

  it('a single oversized item gets its own chunk rather than being dropped', () => {
    // maxBytes = 1 forces every item into its own chunk
    const chunks = splitIntoChunks(makeContext(), 1);
    // 3 issues + 2 PRs = 5 items minimum
    expect(chunks.length).toBeGreaterThanOrEqual(5);
    const allContent = chunks.map((c) => c.content).join('');
    expect(allContent).toContain('Bug: crash on login');
    expect(allContent).toContain('Fix login crash');
  });
});

describe('splitIntoChunks — XML style', () => {
  const xmlConfig = {
    ...defaultConfig,
    output: { ...defaultConfig.output, style: 'xml' as const },
  };

  it('each chunk starts with XML declaration', () => {
    const chunks = splitIntoChunks(makeContext({ config: xmlConfig }), 10_000_000);
    expect(chunks[0].content).toContain('<?xml version="1.0"');
  });

  it('each chunk is wrapped in repissue root element', () => {
    const chunks = splitIntoChunks(makeContext({ config: xmlConfig }), 10_000_000);
    expect(chunks[0].content).toContain('<repissue>');
    expect(chunks[0].content).toContain('</repissue>');
  });

  it('split XML chunks each have their own closing tag', () => {
    const chunks = splitIntoChunks(makeContext({ config: xmlConfig }), 50);
    for (const chunk of chunks) {
      expect(chunk.content).toContain('</repissue>');
    }
  });

  it('includes part metadata in XML', () => {
    const chunks = splitIntoChunks(makeContext({ config: xmlConfig }), 50);
    expect(chunks[0].content).toContain('<part>1</part>');
  });
});

describe('splitIntoChunks — plain style', () => {
  const plainConfig = {
    ...defaultConfig,
    output: { ...defaultConfig.output, style: 'plain' as const },
  };

  it('does not contain markdown headers', () => {
    const chunks = splitIntoChunks(makeContext({ config: plainConfig }), 10_000_000);
    expect(chunks[0].content).not.toContain('## ');
  });

  it('contains OPEN ISSUES section label', () => {
    const chunks = splitIntoChunks(makeContext({ config: plainConfig }), 10_000_000);
    expect(chunks[0].content).toContain('OPEN ISSUES');
  });
});

describe('splitIntoChunks — content integrity', () => {
  it('does not produce chunks with unresolved Handlebars placeholders', () => {
    const chunks = splitIntoChunks(makeContext(), 300);
    for (const chunk of chunks) {
      expect(chunk.content).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });

  it('does not produce chunks containing "undefined" or "[object Object]"', () => {
    const chunks = splitIntoChunks(makeContext(), 300);
    for (const chunk of chunks) {
      expect(chunk.content).not.toContain('undefined');
      expect(chunk.content).not.toContain('[object Object]');
    }
  });
});

// ── writeSplitFiles ────────────────────────────────────────────────────────

describe('writeSplitFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'repissue-split-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a single chunk to the base path with no numbered suffix', async () => {
    const basePath = path.join(tmpDir, 'output.md');
    const written = await writeSplitFiles(basePath, [{ index: 1, content: 'hello' }]);

    expect(written).toEqual([basePath]);
    expect(existsSync(basePath)).toBe(true);
    expect(await readFile(basePath, 'utf-8')).toBe('hello');
  });

  it('writes multiple chunks to numbered paths', async () => {
    const basePath = path.join(tmpDir, 'output.md');
    const chunks = [
      { index: 1, content: 'part one' },
      { index: 2, content: 'part two' },
      { index: 3, content: 'part three' },
    ];

    const written = await writeSplitFiles(basePath, chunks);

    expect(written).toHaveLength(3);
    expect(written[0]).toBe(path.join(tmpDir, 'output-1.md'));
    expect(written[1]).toBe(path.join(tmpDir, 'output-2.md'));
    expect(written[2]).toBe(path.join(tmpDir, 'output-3.md'));
  });

  it('each numbered file contains the correct chunk content', async () => {
    const basePath = path.join(tmpDir, 'output.md');
    await writeSplitFiles(basePath, [
      { index: 1, content: 'content of file one' },
      { index: 2, content: 'content of file two' },
    ]);

    expect(await readFile(path.join(tmpDir, 'output-1.md'), 'utf-8')).toBe('content of file one');
    expect(await readFile(path.join(tmpDir, 'output-2.md'), 'utf-8')).toBe('content of file two');
  });

  it('returns paths in chunk order', async () => {
    const basePath = path.join(tmpDir, 'output.xml');
    const written = await writeSplitFiles(basePath, [
      { index: 1, content: 'a' },
      { index: 2, content: 'b' },
    ]);
    expect(written[0]).toContain('-1.xml');
    expect(written[1]).toContain('-2.xml');
  });

  it('does not write the un-numbered base file when there are multiple chunks', async () => {
    const basePath = path.join(tmpDir, 'output.md');
    await writeSplitFiles(basePath, [
      { index: 1, content: 'a' },
      { index: 2, content: 'b' },
    ]);
    expect(existsSync(basePath)).toBe(false);
  });
});