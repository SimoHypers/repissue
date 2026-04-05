import { get_encoding, type Tiktoken } from 'tiktoken';

/**
 * Thin wrapper around tiktoken's cl100k_base encoder.
 *
 * Matches the encoding used by GPT-4 / Claude — gives a consistent
 * token estimate that can be compared with Repomix output counts.
 *
 * IMPORTANT: Call free() when done to release the underlying WASM memory.
 * Failing to do so leaks memory across worker thread invocations.
 */
export class TokenCounter {
  private encoder: Tiktoken;

  constructor() {
    this.encoder = get_encoding('cl100k_base');
  }

  /**
   * Count the number of tokens in the given text.
   * Returns 0 for null / empty input rather than throwing.
   */
  public countTokens(text: string): number {
    if (!text) return 0;
    return this.encoder.encode(text).length;
  }

  /**
   * Release the underlying WASM encoder.
   * Must be called once the counter is no longer needed.
   */
  public free(): void {
    this.encoder.free();
  }
}