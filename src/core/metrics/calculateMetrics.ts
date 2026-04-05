import Piscina from "tinypool"
import { logger } from '../../shared/logger.js';

export interface MetricsResult {
  /** Exact token count via tiktoken cl100k_base */
  totalTokens: number;
}

/**
 * Count tokens in the rendered output string using tiktoken (cl100k_base)
 * running inside a tinypool worker thread, keeping the main thread free.
 *
 * Falls back to the chars/4 estimate if the worker fails for any reason
 * (missing native module, WASM init error, etc.) so the CLI never crashes
 * just because token counting broke.
 */
export const calculateMetrics = async (output: string): Promise<MetricsResult> => {
  if (!output) return { totalTokens: 0 };

  // Resolve the compiled worker path relative to this file.
  // At runtime this module lives in dist/core/metrics/calculateMetrics.js,
  // so the worker is at dist/core/metrics/workers/calculateMetricsWorker.js.
  const workerUrl = new URL('./workers/calculateMetricsWorker.js', import.meta.url);

  const pool = new Piscina({
    filename: workerUrl.href,
    maxThreads: 1,   // one string, one worker is enough
    minThreads: 0,   // don't keep alive between pack() calls
    idleTimeout: 500,
  });

  try {
    const totalTokens = await pool.run(output) as number;
    return { totalTokens };
  } catch (err) {
    // Graceful fallback — tiktoken's WASM can fail in constrained envs
    logger.warn(
      `Token counting via tiktoken failed, falling back to estimate. Reason: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { totalTokens: Math.round(output.length / 4) };
  } finally {
    await pool.destroy();
  }
};