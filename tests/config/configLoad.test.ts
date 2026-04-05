import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/configLoad.ts';
import { defaultConfig } from '../../src/config/defaultConfig.ts';

// We test the observable effect of resolveFilePath through loadConfig itself —
// the function is private so we don't import it directly.

describe('loadConfig — file extension resolution', () => {
  const base = { token: undefined };

  it('uses .md extension by default (markdown style)', async () => {
    const config = await loadConfig({ ...base });
    expect(config.output.filePath).toBe('repissue-output.md');
  });

  it('switches to .xml when --style xml is passed without --output', async () => {
    const config = await loadConfig({ ...base, style: 'xml' });
    expect(config.output.filePath).toBe('repissue-output.xml');
  });

  it('switches to .txt when --style plain is passed without --output', async () => {
    const config = await loadConfig({ ...base, style: 'plain' });
    expect(config.output.filePath).toBe('repissue-output.txt');
  });

  it('does not change the extension when --style markdown is passed', async () => {
    const config = await loadConfig({ ...base, style: 'markdown' });
    expect(config.output.filePath).toBe('repissue-output.md');
  });

  it('respects an explicit --output path and does NOT change its extension', async () => {
    const config = await loadConfig({ ...base, style: 'xml', output: 'my-output.md' });
    expect(config.output.filePath).toBe('my-output.md');
  });

  it('respects an explicit --output path even when the extension already matches style', async () => {
    const config = await loadConfig({ ...base, style: 'xml', output: 'my-output.xml' });
    expect(config.output.filePath).toBe('my-output.xml');
  });

  it('respects an explicit --output path with no extension', async () => {
    const config = await loadConfig({ ...base, style: 'plain', output: 'my-output' });
    expect(config.output.filePath).toBe('my-output');
  });

  it('the default config filePath is repissue-output.md', () => {
    expect(defaultConfig.output.filePath).toBe('repissue-output.md');
  });
});