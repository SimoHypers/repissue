const JITTER_MAX_MS = 2_000;
const BASE_BACKOFF_MS = 1_000;

export interface RateLimitInfo {
  remaining: number;
  resetAt: number; // Unix timestamp in ms
  waitMs: number;
}

export const sleep = (ms: number):
  Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

export const defaultParseRateLimit = (headers: Headers): RateLimitInfo => {
  const remaining = parseInt(headers.get('X-RateLimit-Remaining') ?? '0', 10);
  const resetUnix = parseInt(headers.get('X-RateLimit-Reset') ?? '0', 10);
  const resetAt = resetUnix * 1_000;
  const jitter = Math.random() * JITTER_MAX_MS;
  // Always wait at least BASE_BACKOFF_MS so we never hammer the API
  const waitMs = Math.max(resetAt - Date.now() + jitter, BASE_BACKOFF_MS);
  return { remaining, resetAt, waitMs };
};

export type ParseRateLimitFn = typeof defaultParseRateLimit;
