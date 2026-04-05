import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock tinypool before importing calculateMetrics ──────────────────────────
// vi.mock is hoisted to the top of the file by Vitest's transformer, so this
// runs before any imports. The factory must be synchronous — top-level await
// breaks hoisting and causes "no default export" errors.
//
// tinypool exports Piscina as a NAMED export (not default), so the mock shape
// must match: { Piscina: <constructor mock> }.

const mockRun = vi.fn();
const mockDestroy = vi.fn();

vi.mock('tinypool', () => {
  // tinypool uses a default export: `import Piscina from 'tinypool'`
  // The mock factory must return { default: <constructor> } to match.
  function Piscina() {
    return { run: mockRun, destroy: mockDestroy };
  }
  return { default: Piscina };
});

// Import AFTER vi.mock — Vitest's hoisting guarantees the mock is in place.
import { calculateMetrics } from '../../../src/core/metrics/calculateMetrics.ts';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('calculateMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDestroy.mockResolvedValue(undefined);
  });

  it('returns 0 tokens for an empty string without calling the worker', async () => {
    const result = await calculateMetrics('');
    expect(result.totalTokens).toBe(0);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('returns the token count produced by the worker', async () => {
    mockRun.mockResolvedValueOnce(1234);
    const result = await calculateMetrics('some output text');
    expect(result.totalTokens).toBe(1234);
  });

  it('passes the full output string to the worker', async () => {
    mockRun.mockResolvedValueOnce(42);
    const text = 'The exact output string to count';
    await calculateMetrics(text);
    expect(mockRun).toHaveBeenCalledWith(text);
  });

  it('always calls pool.destroy() after a successful run', async () => {
    mockRun.mockResolvedValueOnce(100);
    await calculateMetrics('some text');
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('calls pool.destroy() even when the worker throws', async () => {
    mockRun.mockRejectedValueOnce(new Error('WASM init failed'));
    await calculateMetrics('some text');
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('falls back to chars/4 estimate when the worker throws', async () => {
    mockRun.mockRejectedValueOnce(new Error('WASM init failed'));
    const text = 'a'.repeat(400); // 400 chars → 100 tokens
    const result = await calculateMetrics(text);
    expect(result.totalTokens).toBe(100);
  });

  it('falls back gracefully when worker throws a non-Error value', async () => {
    mockRun.mockRejectedValueOnce('string error');
    const text = 'a'.repeat(200); // 200 chars → 50 tokens
    const result = await calculateMetrics(text);
    expect(result.totalTokens).toBe(50);
  });

  it('returns a MetricsResult object with a totalTokens number field', async () => {
    mockRun.mockResolvedValueOnce(999);
    const result = await calculateMetrics('hello');
    expect(result).toHaveProperty('totalTokens');
    expect(typeof result.totalTokens).toBe('number');
  });
});