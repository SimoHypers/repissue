import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initAction } from '../../src/cli/actions/initAction.ts';
import { RepissueError } from '../../src/shared/errorHandle.ts';

const CONFIG_FILE_NAME = 'repissue.config.json';

describe('initAction', () => {
  let tmpDir: string;

  beforeEach(async () => {
    // Fresh isolated temp directory for each test
    tmpDir = await mkdtemp(path.join(tmpdir(), 'repissue-init-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates repissue.config.json in the target directory', async () => {
    await initAction(tmpDir);
    expect(existsSync(path.join(tmpDir, CONFIG_FILE_NAME))).toBe(true);
  });

  it('writes valid JSON', async () => {
    await initAction(tmpDir);
    const raw = await readFile(path.join(tmpDir, CONFIG_FILE_NAME), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('written config has the expected top-level keys', async () => {
    await initAction(tmpDir);
    const raw = await readFile(path.join(tmpDir, CONFIG_FILE_NAME), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('output');
    expect(parsed).toHaveProperty('github');
    expect(parsed).toHaveProperty('security');
  });

  it('written config includes expected output defaults', async () => {
    await initAction(tmpDir);
    const raw = await readFile(path.join(tmpDir, CONFIG_FILE_NAME), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.output.filePath).toBe('repissue-output.md');
    expect(parsed.output.style).toBe('markdown');
    expect(parsed.output.fileSummary).toBe(true);
  });

  it('written config includes expected github defaults', async () => {
    await initAction(tmpDir);
    const raw = await readFile(path.join(tmpDir, CONFIG_FILE_NAME), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.github.includeIssues).toBe(true);
    expect(parsed.github.includePRs).toBe(true);
    expect(parsed.github.ignoreBots).toBe(true);
    expect(parsed.github.maxCommentsPerItem).toBe(50);
    expect(parsed.github.labelPriority).toEqual(['bug', 'security', 'P0']);
    expect(parsed.github.knownBots).toContain('dependabot[bot]');
  });

  it('written config includes security section', async () => {
    await initAction(tmpDir);
    const raw = await readFile(path.join(tmpDir, CONFIG_FILE_NAME), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.security.enableCheck).toBe(false);
  });

  it('throws RepissueError if config file already exists', async () => {
    // Pre-create the file
    await writeFile(path.join(tmpDir, CONFIG_FILE_NAME), '{}', 'utf-8');

    await expect(initAction(tmpDir)).rejects.toThrow(RepissueError);
  });

  it('error message mentions the config file name when it already exists', async () => {
    await writeFile(path.join(tmpDir, CONFIG_FILE_NAME), '{}', 'utf-8');

    await expect(initAction(tmpDir)).rejects.toThrow(CONFIG_FILE_NAME);
  });

  it('does not overwrite an existing config', async () => {
    const original = '{"custom": true}';
    await writeFile(path.join(tmpDir, CONFIG_FILE_NAME), original, 'utf-8');

    try {
      await initAction(tmpDir);
    } catch {
      // expected — we just want to check the file was not touched
    }

    const after = await readFile(path.join(tmpDir, CONFIG_FILE_NAME), 'utf-8');
    expect(after).toBe(original);
  });

  it('written JSON ends with a newline (POSIX compliance)', async () => {
    await initAction(tmpDir);
    const raw = await readFile(path.join(tmpDir, CONFIG_FILE_NAME), 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
  });
});