import { describe, it, expect } from 'vitest';
import {
  scanForSecrets,
  formatScanWarning,
  redact,
  SCAN_PATTERNS,
} from '../../../src/core/security/securityScan.ts';

// ── redact ─────────────────────────────────────────────────────────────────

describe('redact', () => {
  it('shows first 6 chars for long values and appends ***', () => {
    expect(redact('ghp_abcdefghijklmnopqrstuvwxyz123456')).toBe('ghp_ab***');
  });

  it('shows only 2 chars for short values', () => {
    expect(redact('abc123')).toBe('ab***');
  });

  it('never exposes the full secret', () => {
    const secret = 'sk-supersecretvalue1234567890';
    const result = redact(secret);
    expect(result).not.toBe(secret);
    expect(result.endsWith('***')).toBe(true);
  });
});

// ── scanForSecrets — no hits ───────────────────────────────────────────────

describe('scanForSecrets — clean input', () => {
  it('returns empty array for empty string', () => {
    expect(scanForSecrets('')).toEqual([]);
  });

  it('returns empty array for normal prose with no secrets', () => {
    const text = [
      '# repissue Output',
      '## Open Issues (3)',
      '### #42 — Bug: login crash',
      'This is a normal issue body with no secrets.',
      '- alice: Confirmed reproducible on v2.3.',
    ].join('\n');
    expect(scanForSecrets(text)).toEqual([]);
  });

  it('does not false-positive on short sk- strings', () => {
    // "sk-" followed by fewer than 20 chars should not match
    expect(scanForSecrets('sk-short')).toEqual([]);
    expect(scanForSecrets('skill-set is important')).toEqual([]);
  });

  it('does not false-positive on short password values', () => {
    // Values under 12 chars should not match the generic assignment pattern
    expect(scanForSecrets('password="changeme"')).toEqual([]);
    expect(scanForSecrets('password="short"')).toEqual([]);
  });

  it('does not false-positive on AKIA-like strings that are too short', () => {
    expect(scanForSecrets('AKIA123')).toEqual([]);
  });
});

// ── scanForSecrets — GitHub tokens ────────────────────────────────────────

describe('scanForSecrets — GitHub tokens', () => {
  it('detects a classic GitHub PAT (ghp_)', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const hits = scanForSecrets(`Token: ${token}`);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('GitHub personal access token');
  });

  it('detects a fine-grained GitHub PAT (github_pat_)', () => {
    const token = 'github_pat_' + 'A'.repeat(82);
    const hits = scanForSecrets(`Auth: ${token}`);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('fine-grained');
  });

  it('detects a GitHub OAuth token (gho_)', () => {
    const token = 'gho_' + 'B'.repeat(36);
    const hits = scanForSecrets(token);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('OAuth');
  });

  it('detects a GitHub server-to-server token (ghs_)', () => {
    const token = 'ghs_' + 'C'.repeat(36);
    const hits = scanForSecrets(token);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('server-to-server');
  });

  it('reports the correct line number', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const text = 'line one\nline two\n' + token + '\nline four';
    const hits = scanForSecrets(text);
    expect(hits[0].line).toBe(3);
  });

  it('redacts the token in the hit', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const hits = scanForSecrets(token);
    expect(hits[0].redacted).not.toContain(token);
    expect(hits[0].redacted.endsWith('***')).toBe(true);
  });
});

// ── scanForSecrets — API keys ──────────────────────────────────────────────

describe('scanForSecrets — API secret keys', () => {
  it('detects an OpenAI-style sk- key', () => {
    const key = 'sk-proj-' + 'x'.repeat(40);
    const hits = scanForSecrets(`OPENAI_API_KEY=${key}`);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('sk-');
  });

  it('detects an Anthropic-style sk-ant key', () => {
    const key = 'sk-ant-api03-' + 'x'.repeat(40);
    const hits = scanForSecrets(key);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects a Stripe secret key', () => {
    const key = 'sk_live_' + 'a'.repeat(30);
    const hits = scanForSecrets(key);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('Stripe');
  });
});

// ── scanForSecrets — AWS ───────────────────────────────────────────────────

describe('scanForSecrets — AWS', () => {
  it('detects an AWS access key ID', () => {
    const hits = scanForSecrets('AKIAIOSFODNN7EXAMPLE');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('AWS access key ID');
  });

  it('detects an AWS secret access key in assignment context', () => {
    const line = 'aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    const hits = scanForSecrets(line);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('AWS secret');
  });

  it('detects AWS_SECRET_ACCESS_KEY (uppercase env var form)', () => {
    const line = 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    const hits = scanForSecrets(line);
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ── scanForSecrets — PEM keys ──────────────────────────────────────────────

describe('scanForSecrets — PEM private keys', () => {
  it('detects a generic private key header', () => {
    const hits = scanForSecrets('-----BEGIN PRIVATE KEY-----');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('Private key');
  });

  it('detects an RSA private key header', () => {
    const hits = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects an OpenSSH private key header', () => {
    const hits = scanForSecrets('-----BEGIN OPENSSH PRIVATE KEY-----');
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ── scanForSecrets — generic assignments ──────────────────────────────────

describe('scanForSecrets — generic secret assignments', () => {
  it('detects password="long-enough-value"', () => {
    const hits = scanForSecrets('password="supersecretvalue123"');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('Password/secret');
  });

  it('detects api_key="long-enough-value"', () => {
    const hits = scanForSecrets("api_key='my-long-api-key-value-here'");
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects secret: long-enough-value (colon separator)', () => {
    const hits = scanForSecrets('secret: "my-very-secret-value-1234"');
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ── scanForSecrets — Slack & SendGrid ─────────────────────────────────────

describe('scanForSecrets — Slack and SendGrid', () => {
  it('detects a Slack bot token (xoxb-)', () => {
    const hits = scanForSecrets('xoxb-123456789012-123456789012-abcdefghijklmnop');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('Slack');
  });

  it('detects a SendGrid API key', () => {
    const key = 'SG.' + 'a'.repeat(22) + '.' + 'b'.repeat(43);
    const hits = scanForSecrets(key);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('SendGrid');
  });
});

// ── scanForSecrets — multi-line / realistic output ─────────────────────────

describe('scanForSecrets — realistic output fragments', () => {
  it('finds a secret buried in a realistic issue body', () => {
    const text = [
      '## Open Issues (1)',
      '',
      '### #7 — Auth service is broken',
      '',
      'We deployed with the wrong key: ghp_' + 'Z'.repeat(36),
      'Please rotate immediately.',
      '',
    ].join('\n');

    const hits = scanForSecrets(text);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].line).toBe(5);
  });

  it('finds multiple secrets across different lines', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const awsKey = 'AKIAIOSFODNN7EXAMPLE';
    const text = `Token: ${token}\nAWS: ${awsKey}`;
    const hits = scanForSecrets(text);
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('returns unique line numbers for secrets on different lines', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const awsKey = 'AKIAIOSFODNN7EXAMPLE';
    const text = `line1\n${token}\nline3\n${awsKey}`;
    const hits = scanForSecrets(text);
    const lines = hits.map((h) => h.line);
    expect(lines).toContain(2);
    expect(lines).toContain(4);
  });
});

// ── formatScanWarning ──────────────────────────────────────────────────────

describe('formatScanWarning', () => {
  it('returns null when hits array is empty', () => {
    expect(formatScanWarning([])).toBeNull();
  });

  it('returns a string when there are hits', () => {
    const hits = [{ label: 'GitHub personal access token', redacted: 'ghp_ab***', line: 3 }];
    const result = formatScanWarning(hits);
    expect(typeof result).toBe('string');
  });

  it('includes the hit count in the warning', () => {
    const hits = [
      { label: 'GitHub personal access token', redacted: 'ghp_ab***', line: 3 },
      { label: 'AWS access key ID', redacted: 'AKIAIO***', line: 7 },
    ];
    const result = formatScanWarning(hits)!;
    expect(result).toContain('2');
  });

  it('includes each hit label in the warning', () => {
    const hits = [{ label: 'AWS access key ID', redacted: 'AKIAIO***', line: 7 }];
    const result = formatScanWarning(hits)!;
    expect(result).toContain('AWS access key ID');
  });

  it('includes line numbers in the warning', () => {
    const hits = [{ label: 'Slack token', redacted: 'xoxb-1***', line: 42 }];
    const result = formatScanWarning(hits)!;
    expect(result).toContain('42');
  });

  it('includes the redacted value in the warning', () => {
    const hits = [{ label: 'Stripe secret key', redacted: 'sk_liv***', line: 1 }];
    const result = formatScanWarning(hits)!;
    expect(result).toContain('sk_liv***');
  });

  it('includes a remediation message', () => {
    const hits = [{ label: 'test', redacted: 'abc***', line: 1 }];
    const result = formatScanWarning(hits)!;
    expect(result.toLowerCase()).toContain('rotate');
  });

  it('does not include the unredacted secret value', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const hits = scanForSecrets(token);
    const result = formatScanWarning(hits)!;
    expect(result).not.toContain(token);
  });
});

// ── SCAN_PATTERNS sanity ───────────────────────────────────────────────────

describe('SCAN_PATTERNS', () => {
  it('exports a non-empty array of patterns', () => {
    expect(SCAN_PATTERNS.length).toBeGreaterThan(0);
  });

  it('every pattern has a label and a regex', () => {
    for (const p of SCAN_PATTERNS) {
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.regex).toBeInstanceOf(RegExp);
    }
  });

  it('every regex has the global flag', () => {
    for (const p of SCAN_PATTERNS) {
      expect(p.regex.flags).toContain('g');
    }
  });
});