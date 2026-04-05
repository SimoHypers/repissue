/**
 * Simple regex-based secret scanner.
 *
 * Scans a rendered output string for common secret patterns and returns a list
 * of hits. Each hit includes a redacted match so the warning message itself
 * does not leak the secret.
 *
 * Design principles:
 * - No external dependencies — pure regex, no secretlint/trufflehog in v1.
 * - Favour low false-positive patterns (anchored prefixes, minimum lengths,
 *   character-class constraints) over broad catch-alls.
 * - Never block output generation — callers decide what to do with hits.
 * - Redact all matched values before returning so logs/warnings are safe.
 */

export interface ScanPattern {
  /** Human-readable label shown in warnings */
  label: string;
  /** The regex used to detect the secret */
  regex: RegExp;
}

export interface ScanHit {
  /** Human-readable label from the matched pattern */
  label: string;
  /** Redacted match: first 6 chars visible, rest replaced with *** */
  redacted: string;
  /** 1-based line number in the scanned text */
  line: number;
}

// ── Pattern definitions ────────────────────────────────────────────────────
//
// Each regex must have exactly one capture group containing the secret value.
// The captured group is what gets redacted in the output.

export const SCAN_PATTERNS: ScanPattern[] = [
  // GitHub personal access tokens (classic)
  // Format: ghp_ followed by 36 alphanumeric chars
  {
    label: 'GitHub personal access token (classic)',
    regex: /\b(ghp_[A-Za-z0-9]{36})\b/g,
  },

  // GitHub fine-grained personal access tokens
  // Format: github_pat_ followed by 82+ alphanumeric/underscore chars
  {
    label: 'GitHub fine-grained personal access token',
    regex: /\b(github_pat_[A-Za-z0-9_]{82,})\b/g,
  },

  // GitHub OAuth / app tokens
  {
    label: 'GitHub OAuth token',
    regex: /\b(gho_[A-Za-z0-9]{36})\b/g,
  },

  // GitHub Actions / installation tokens
  {
    label: 'GitHub server-to-server token',
    regex: /\b(ghs_[A-Za-z0-9]{36})\b/g,
  },

  // OpenAI / Anthropic style secret keys — sk- followed by 20+ non-whitespace chars
  // Catches: sk-proj-..., sk-ant-..., sk-<random>
  {
    label: 'API secret key (sk- prefix)',
    regex: /\b(sk-[A-Za-z0-9_\-]{20,})\b/g,
  },

  // AWS Access Key IDs — AKIA + 16 uppercase alphanumeric chars
  {
    label: 'AWS access key ID',
    regex: /\b(AKIA[A-Z0-9]{16})\b/g,
  },

  // AWS Secret Access Keys — typically 40 base64 chars, commonly seen after
  // "aws_secret_access_key" or "AWS_SECRET" in assignment context
  {
    label: 'AWS secret access key (assignment)',
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["']?([A-Za-z0-9/+]{40})["']?/gi,
  },

  // PEM private key headers
  {
    label: 'Private key (PEM header)',
    regex: /(-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----)/g,
  },

  // Generic high-confidence secret assignments:
  // password = "something-long-enough-to-not-be-a-placeholder"
  // Require value length >= 12 to avoid matching password=changeme etc.
  {
    label: 'Password/secret assignment',
    regex: /(?:password|passwd|secret|api_key|apikey|api_secret)\s*[=:]\s*["']([^"'\s]{12,})["']/gi,
  },

  // Slack bot/app tokens
  {
    label: 'Slack token',
    regex: /\b(xox[baprs]-[A-Za-z0-9\-]{10,})\b/g,
  },

  // Stripe secret keys
  {
    label: 'Stripe secret key',
    regex: /\b(sk_live_[A-Za-z0-9]{24,})\b/g,
  },

  // SendGrid API keys
  {
    label: 'SendGrid API key',
    regex: /\b(SG\.[A-Za-z0-9_\-]{22,}\.[A-Za-z0-9_\-]{43,})\b/g,
  },

  // Generic bearer tokens in Authorization headers (long enough to be real)
  {
    label: 'Bearer token (Authorization header)',
    regex: /Authorization:\s*Bearer\s+([A-Za-z0-9_\-.]{30,})/gi,
  },
];

// ── Redaction ──────────────────────────────────────────────────────────────

/**
 * Redact a secret value for safe display in warnings.
 * Shows the first 6 characters then replaces the rest with ***.
 * For very short matches the threshold drops to 2 chars visible.
 */
export const redact = (value: string): string => {
  const visibleChars = value.length > 10 ? 6 : 2;
  return value.slice(0, visibleChars) + '***';
};

// ── Scanner ────────────────────────────────────────────────────────────────

/**
 * Scan the rendered output string for secret patterns.
 *
 * Returns an array of ScanHit objects. Empty array = no hits found.
 * The scan is performed on a line-by-line basis so we can report line numbers.
 */
export const scanForSecrets = (output: string): ScanHit[] => {
  if (!output) return [];

  const hits: ScanHit[] = [];
  const lines = output.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (const pattern of SCAN_PATTERNS) {
      // Reset lastIndex before each use — all regexes have the g flag
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(line)) !== null) {
        // Capture group 1 is always the secret value
        const secret = match[1] ?? match[0];
        hits.push({
          label: pattern.label,
          redacted: redact(secret),
          line: lineIdx + 1,
        });
      }
    }
  }

  return hits;
};

// ── Warning formatter ──────────────────────────────────────────────────────

/**
 * Format scan hits into a human-readable warning block suitable for
 * passing to logger.warn().
 *
 * Returns null when there are no hits so callers can skip logging entirely.
 */
export const formatScanWarning = (hits: ScanHit[]): string | null => {
  if (hits.length === 0) return null;

  const lines: string[] = [
    `⚠  Security scan found ${hits.length} potential secret(s) in the output:`,
    '',
  ];

  for (const hit of hits) {
    lines.push(`   Line ${hit.line}: ${hit.label} — ${hit.redacted}`);
  }

  lines.push('');
  lines.push('   Review the output before sharing. Remove or rotate any exposed credentials.');

  return lines.join('\n');
};