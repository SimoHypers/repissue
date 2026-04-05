import { TokenCounter } from '../TokenCounter.js';

/**
 * Tinypool worker entry point.
 *
 * Tinypool calls the default export with whatever argument was passed to
 * pool.run(). We receive the full rendered output string and return the
 * token count so the main thread stays unblocked during WASM execution.
 *
 * The TokenCounter is created and freed within each task — workers are
 * reused by the pool so we must not hold the encoder across invocations.
 */
export default function calculateMetricsWorker(output: string): number {
  const counter = new TokenCounter();
  try {
    return counter.countTokens(output);
  } finally {
    counter.free();
  }
}