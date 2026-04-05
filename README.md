# repissue

> Pack GitHub Issues & Pull Requests into a single AI-ready context file.

[![CI](https://github.com/your-username/repissue/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/repissue/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/repissue.svg)](https://www.npmjs.com/package/repissue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js ≥ 18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

AI coding agents understand your code — but they have no idea what bugs are open, which PRs are in flight, or what discussions are happening in your issue tracker. **repissue** fills that gap.

One command produces a structured, signal-dense file you can drop straight into any LLM's context window alongside a [Repomix](https://github.com/yamadashy/repomix) code snapshot:

```bash
npx repissue facebook/react
# → repissue-output.md  (~28,400 tokens of structured issue/PR context)
```

---

## Table of Contents

- [Why repissue?](#why-repissue)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Full Flag Reference](#full-flag-reference)
- [Configuration File](#configuration-file)
- [Output Styles](#output-styles)
- [Composing with Repomix](#composing-with-repomix)
- [Using with AI Agents](#using-with-ai-agents)
- [Rate Limits & Authentication](#rate-limits--authentication)
- [Security Scanning](#security-scanning)
- [Contributing](#contributing)
- [License](#license)

---

## Why repissue?

When you feed a codebase to an AI agent with Repomix, the agent knows everything about the source — but nothing about the live project state. It might:

- Suggest a fix for a bug that's already being worked on in an open PR.
- Duplicate effort on a feature that's halfway through review.
- Miss the discussion in issue #312 that explains *why* a particular design decision was made.

repissue is the complementary tool. Together they give an agent complete situational awareness:

```
repomix output  →  everything the code *is*
repissue output →  everything that needs to *change*
```

---

## Installation

**Zero-install via npx (recommended):**
```bash
npx repissue owner/repo
```

**Global install:**
```bash
npm install -g repissue
repissue owner/repo
```

**As a project dependency:**
```bash
npm install --save-dev repissue
```

Requires **Node.js ≥ 18**.

---

## Quickstart

```bash
# Fetch open issues and PRs from any public repo
npx repissue facebook/react

# Authenticate for private repos (or to raise the rate limit to 5,000 req/hr)
# bash / zsh (macOS, Linux)
GITHUB_TOKEN=ghp_xxx npx repissue my-org/private-repo
# PowerShell (Windows)
$env:GITHUB_TOKEN="ghp_xxx"; npx repissue my-org/private-repo

# Print to stdout instead of writing a file
npx repissue owner/repo --stdout

# XML output — pairs perfectly with a Repomix XML snapshot
npx repissue owner/repo --style xml

# Issues only, skipping PRs
npx repissue owner/repo --no-prs

# Include PRs merged in the last 14 days
npx repissue owner/repo --include-merged-days 14

# Split into multiple files if output exceeds 500 KB
npx repissue owner/repo --split-output 512000
```

After running, repissue prints a summary:

```
✓ Packed 47 issues and 12 PRs

  Issues:  47
  PRs:     12
  Tokens:  ~28,400

  → repissue-output.md
```

---

## Full Flag Reference

| Flag | Default | Description |
|------|---------|-------------|
| `<owner/repo>` | _(required)_ | GitHub repository to fetch, e.g. `facebook/react` |
| `-o, --output <path>` | auto | Output file path. Defaults to `repissue-output.{md,txt,xml}` based on style |
| `--style <format>` | `markdown` | Output style: `markdown`, `plain`, or `xml` |
| `--token <token>` | `$GITHUB_TOKEN` | GitHub personal access token. Falls back to the `GITHUB_TOKEN` env var |
| `--no-issues` | — | Skip issues; output PRs only |
| `--no-prs` | — | Skip PRs; output issues only |
| `--include-merged-days <n>` | — | Also include PRs merged within the last N days |
| `--include-closed-days <n>` | — | Also include issues closed within the last N days |
| `--label-priority <labels>` | `bug,security,P0` | Comma-separated labels to float to the top of the output |
| `--max-comments <n>` | `50` | Maximum number of comments to include per issue or PR |
| `--no-bots` | — | Filter out all bot-authored comments (default: on when `ignoreBots: true` in config) |
| `--header-text <text>` | — | Custom text to embed at the top of the output file |
| `-c, --config <path>` | auto | Path to `repissue.config.json`. Auto-detected in the current directory if not specified |
| `--init` | — | Create a starter `repissue.config.json` in the current directory |
| `--stdout` | — | Print output to stdout instead of writing a file |
| `--append-to <file>` | — | Append the issues/PRs block to an existing file (e.g. a Repomix output). Cannot be combined with `--stdout` or `--split-output` |
| `--split-output <bytes>` | — | Split output into multiple numbered files if it exceeds N bytes. Cannot be combined with `--stdout` or `--append-to` |
| `--copy` | — | Copy output to clipboard after writing. Uses `pbcopy` (macOS), `clip` (Windows), or `xclip`/`xsel` (Linux) |
| `--security-check` | — | Warn if the output appears to contain secrets or credentials |
| `--verbose` | — | Enable verbose logging |
| `--quiet` | — | Suppress all output except errors |
| `--version` | — | Print version and exit |

### Flag notes

**`--style` and output file extension**

When `--output` is not specified, repissue automatically picks the right file extension for the chosen style:

| Style | Extension |
|-------|-----------|
| `markdown` | `.md` |
| `plain` | `.txt` |
| `xml` | `.xml` |

If you pass `--output` explicitly, the extension is left exactly as you wrote it.

**`--no-bots` vs config**

`--no-bots` is a one-shot CLI override. For permanent bot filtering, set `ignoreBots: true` in `repissue.config.json` (it is `true` by default).

**`--copy` with `--split-output`**

When output is split into multiple files, `--copy` is silently skipped with a warning. Copy the individual files manually if needed.

---

## Configuration File

Run `repissue --init` to create a starter `repissue.config.json` in the current directory:

```bash
npx repissue --init
```

This creates:

```json
{
  "output": {
    "filePath": "repissue-output.md",
    "style": "markdown",
    "fileSummary": true
  },
  "github": {
    "includeIssues": true,
    "includePRs": true,
    "labelPriority": ["bug", "security", "P0"],
    "ignoreBots": true,
    "knownBots": [
      "dependabot[bot]",
      "renovate[bot]",
      "github-actions[bot]"
    ],
    "maxCommentsPerItem": 50
  },
  "security": {
    "enableCheck": false
  }
}
```

CLI flags always take precedence over the config file.

### Full config reference

#### `output`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `filePath` | string | `"repissue-output.md"` | Output file path |
| `style` | `"markdown"` \| `"plain"` \| `"xml"` | `"markdown"` | Output format |
| `fileSummary` | boolean | `true` | Include a short "what is this file" summary section at the top |
| `headerText` | string | — | Optional custom text inserted at the very top of the output |

#### `github`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | string | — | GitHub personal access token. Prefer the `GITHUB_TOKEN` env var over storing a token in the config file |
| `includeIssues` | boolean | `true` | Fetch and include open issues |
| `includePRs` | boolean | `true` | Fetch and include open pull requests |
| `includeMergedDays` | number | — | Include PRs merged within the last N days |
| `includeClosedDays` | number | — | Include issues closed within the last N days |
| `labelPriority` | string[] | `["bug","security","P0"]` | Labels whose items appear first in the output. Order matters: the first label in the list has the highest priority |
| `ignoreBots` | boolean | `true` | Filter out issues, PRs, and comments authored by bot accounts |
| `knownBots` | string[] | `["dependabot[bot]","renovate[bot]","github-actions[bot]"]` | Additional bot logins to filter. Any login ending in `[bot]` is always treated as a bot regardless of this list |
| `maxCommentsPerItem` | number | `50` | Maximum number of comments to include per issue or PR, after noise filtering |

#### `security`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableCheck` | boolean | `false` | Scan output for patterns that look like secrets or credentials and warn before writing |

### Config file search

repissue looks for `repissue.config.json` in the current working directory. Pass `-c <path>` to use a different location:

```bash
repissue owner/repo -c ./config/repissue.config.json
```

---

## Output Styles

### `markdown` (default)

Structured Markdown — readable by humans, ideal for LLMs that understand Markdown formatting.

```markdown
# repissue Output

> **Generated:** 2026-04-04T10:00:00.000Z
> **Repository:** facebook/react
> **Open Issues:** 47 | **Open PRs:** 12

## Open Issues (47)

### [bug][P0] #312 — Auth token not refreshed on 401

**Opened:** 2026-03-15 | **Author:** alice | **Comments:** 8
**Linked PRs / Closes:** #318

When the access token expires mid-session, the client throws an unhandled
promise rejection rather than refreshing…

**Comments (3 shown, 5 filtered as noise):**

- **bob** (2026-03-16): Confirmed on v2.x as well.
- **alice** (2026-03-17): Root cause is in `refreshToken()`.
```

### `plain`

Plain text with ASCII section dividers — useful for older toolchains or when you want to avoid any Markdown interpretation.

```
repissue Output
Generated: 2026-04-04T10:00:00.000Z
Repository: facebook/react
Open Issues: 47 | Open PRs: 12

================================================================================
OPEN ISSUES (47)
================================================================================

[bug, P0] #312 — Auth token not refreshed on 401
Opened: 2026-03-15 | Author: alice | Comments: 8
```

### `xml`

Structured XML — well-suited for systematic parsing and for feeding into tools that already consume XML (such as a Repomix XML output).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<repissue>
  <metadata>
    <generated_at>2026-04-04T10:00:00.000Z</generated_at>
    <repository>facebook/react</repository>
    <open_issues>47</open_issues>
    <open_prs>12</open_prs>
  </metadata>
  <issues count="47">
    <issue number="312">
      <title>Auth token not refreshed on 401</title>
      <state>open</state>
      <author>alice</author>
      …
    </issue>
  </issues>
</repissue>
```

---

## Composing with Repomix

repissue is designed to be used alongside [Repomix](https://github.com/yamadashy/repomix). Repomix packs the *code*; repissue packs the *live project state*. Feed both to an agent and it has complete context.

### Option 1 — Two separate files

```bash
# Pack the codebase
repomix

# Pack issues and PRs
npx repissue owner/repo

# Feed both to an agent
claude --file repomix-output.xml --file repissue-output.xml \
  "Fix the bug described in issue #312"
```

### Option 2 — Append to a single file (recommended for XML)

The `--append-to` flag inserts a `<repissue_append>` block directly before the closing root tag of an existing XML file, keeping the result well-formed:

```bash
repomix                                                 # creates repomix-output.xml
npx repissue owner/repo --append-to repomix-output.xml # appends inside </repomix>

# One file — full context
claude --file repomix-output.xml "Implement the feature requested in issue #88"
```

For Markdown output, `--append-to` appends a `## repissue — Issues & PRs` section to the end of the target file:

```bash
repomix --style markdown
npx repissue owner/repo --append-to repomix-output.md
```

### Option 3 — Pipe to stdout

```bash
# Stream repissue output directly into another tool
npx repissue owner/repo --stdout | my-agent-tool --context -
```

---

## Using with AI Agents

### Claude

```bash
# Standalone repissue context
claude --file repissue-output.md "What are the most critical open bugs?"

# Combined with Repomix
repomix && npx repissue owner/repo --append-to repomix-output.xml
claude --file repomix-output.xml "Fix the highest-priority open issue"
```

### GitHub Actions

Automatically generate a fresh context file before each agent run:

```yaml
- name: Generate issue context
  run: npx repissue ${{ github.repository }} --output repissue-output.md
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Run agent
  run: my-agent --context repissue-output.md
```

### Cursor / IDE chat

Drop `repissue-output.md` into your workspace and reference it in your chat:

```
@repissue-output.md  What bugs are blocking the v2.0 release?
```

---

## Rate Limits & Authentication

| Mode | Rate limit |
|------|-----------|
| Unauthenticated | 60 requests/hour |
| Authenticated (`GITHUB_TOKEN`) | 5,000 requests/hour |

For any repo with more than a handful of issues, set `GITHUB_TOKEN`:

**bash / zsh (macOS, Linux)**
```bash
# Persist for the session
export GITHUB_TOKEN=ghp_your_token_here
npx repissue owner/repo

# One-shot inline
GITHUB_TOKEN=ghp_xxx npx repissue owner/repo
```

**PowerShell (Windows)**
```powershell
# Persist for the session
$env:GITHUB_TOKEN="ghp_your_token_here"
npx repissue owner/repo

# One-shot inline
$env:GITHUB_TOKEN="ghp_xxx"; npx repissue owner/repo
```

**Command Prompt (Windows)**
```cmd
set GITHUB_TOKEN=ghp_xxx && npx repissue owner/repo
```

**Any platform — via CLI flag** (avoid in scripts, token is visible in process list)
```bash
npx repissue owner/repo --token ghp_xxx
```

**Creating a token:** Go to GitHub → Settings → Developer settings → Personal access tokens. For public repos, no scopes are required. For private repos, select the `repo` scope.

When the rate limit is hit, repissue automatically waits and retries up to 3 times before giving up with a clear error message that includes the reset time.

---

## Security Scanning

repissue can warn you if the output contains patterns that look like secrets or credentials — useful when issue threads discuss environment configuration or paste log output.

Enable it with `--security-check` or in your config:

```json
{
  "security": {
    "enableCheck": true
  }
}
```

Detected pattern types include GitHub tokens, AWS access keys, API secret keys (`sk-` prefix), PEM private key headers, Slack tokens, Stripe keys, SendGrid API keys, and generic password/secret assignments.

**Important:** repissue always writes the output file regardless of scan hits. It warns you so you can review and rotate credentials — it does not block or redact.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup, test commands, and PR guidelines.

---

## License

[MIT](./LICENSE)