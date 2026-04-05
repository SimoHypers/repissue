import { describe, it, expect } from 'vitest';
import { TokenCounter } from '../../../src/core/metrics/TokenCounter.ts';

// These tests exercise the tiktoken WASM encoder directly.
// They are intentionally lightweight — we verify the contract
// (count > 0 for real text, 0 for empty, free() doesn't throw)
// rather than asserting exact token counts which vary by tiktoken version.

describe('TokenCounter', () => {
  it('returns a positive token count for a non-empty string', () => {
    const counter = new TokenCounter();
    try {
      const count = counter.countTokens('Hello, world!');
      expect(count).toBeGreaterThan(0);
    } finally {
      counter.free();
    }
  });

  it('returns 0 for an empty string', () => {
    const counter = new TokenCounter();
    try {
      expect(counter.countTokens('')).toBe(0);
    } finally {
      counter.free();
    }
  });

  it('returns a higher count for a longer string', () => {
    const counter = new TokenCounter();
    try {
      const short = counter.countTokens('Hello');
      const long = counter.countTokens('Hello, this is a much longer string with many more words and tokens in it');
      expect(long).toBeGreaterThan(short);
    } finally {
      counter.free();
    }
  });

  it('counts tokens consistently across multiple calls on the same instance', () => {
    const counter = new TokenCounter();
    try {
      const text = 'The quick brown fox jumps over the lazy dog';
      const first = counter.countTokens(text);
      const second = counter.countTokens(text);
      expect(first).toBe(second);
    } finally {
      counter.free();
    }
  });

  it('returns a plausible token count (not wildly off from chars/4 heuristic)', () => {
    const counter = new TokenCounter();
    try {
      // For typical English prose, tiktoken cl100k_base gives roughly 1 token per 4 chars.
      // We allow a 3x range either side to be resilient to tiktoken version changes
      // while still catching a completely broken encoder (e.g. returning 0 or 1).
      const text = 'This is a typical English sentence used for testing token counts.';
      const count = counter.countTokens(text);
      const charsOver4 = text.length / 4;
      expect(count).toBeGreaterThan(charsOver4 / 3);
      expect(count).toBeLessThan(charsOver4 * 3);
    } finally {
      counter.free();
    }
  });

  it('free() does not throw', () => {
    const counter = new TokenCounter();
    expect(() => counter.free()).not.toThrow();
  });

  it('handles a multiline markdown string (realistic repissue output fragment)', () => {
    const counter = new TokenCounter();
    try {
      const markdown = `
## Open Issues (3)

### [bug] #42 — Login crash on Safari

**Opened:** 2026-01-01 | **Author:** alice | **Comments:** 5

When the user logs in using Safari 17 on macOS Sonoma, the page crashes
immediately after submitting the form. Stack trace points to \`auth.js:142\`.

**Comments (2 shown, 3 filtered as noise):**
- **bob** (2026-01-02): Confirmed on Safari 17.2 as well.
- **carol** (2026-01-03): Looks like a Promise rejection that isn't caught.
      `.trim();
      const count = counter.countTokens(markdown);
      expect(count).toBeGreaterThan(0);
    } finally {
      counter.free();
    }
  });
});