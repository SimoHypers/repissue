<div align="center">
  <img src="public/assets/repissue-logo.svg" alt="repissue logo" width="600" />

  <br/>

  [![npm version](https://img.shields.io/npm/v/repissue.svg)](https://www.npmjs.com/package/repissue)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js ≥ 18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

</div>

> Pack GitHub Issues & Pull Requests into a single AI-ready context file.

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
- [CLI Flags](#cli-flags)
- [Configuration File](#configuration-file)
- [Output Styles](#output-styles)
- [Composing with Repomix](#composing-with-repomix)
- [Using with AI Agents](#using-with-ai-agents)
- [Rate Limits & Authentication](#rate-limits--authentication)
- [Security Scanning](#security-scanning)
- [License](#license)

---

## Why repissue?

When you feed a codebase to an AI agent with Repomix, the agent knows everything about the source — but nothing about the live project state. It might:

- Suggest a fix for a bug that's already being worked on in an open PR.
- Duplicate effort on a feature that's halfway through review.
- Miss the discussion in issue #312 that explains *why* a particular design decision was made.

repissue is the complementary tool. Together they give an agent complete situational awareness:

```
repomix output  →  everything the code is
repissue output →  everything that needs to change
```

---

## Installation

**Zero-install via npx (recommended)**
```bash
npx repissue owner/repo
```

**Global install**
```bash
npm install -g repissue
repissue owner/repo
```

**As a project dependency**
```bash
npm install --save-dev repissue
```

Requires **Node.js ≥ 18**.

---

## Quickstart

```bash
# Set your token first (see Rate Limits & Authentication below)
export GITHUB_TOKEN=ghp_your_token_here        # bash/zsh
$env:GITHUB_TOKEN="ghp_your_token_here"        # PowerShell

# Fetch open issues and PRs
npx repissue facebook/react

# XML output — pairs perfectly with a Repomix XML snapshot
npx repissue owner/repo --style xml

# Issues only, no PRs
npx repissue owner/repo --no-prs

# Include PRs merged in the last 14 days
npx repissue owner/repo --include-merged-days 14

# Print to stdout
npx repissue owner/repo --stdout

# Append directly to an existing Repomix output
repomix && npx repissue owner/repo --append-to repomix-output.xml
```

After running, repissue prints a summary:

```
✓ Packed 47 issues and 12 PRs

  Issues:  47
  PRs:     12
  Tokens:  ~28,400

  → repissue-output.md
```

> [!WARNING]
> **Always set a `GITHUB_TOKEN` before running repissue.**
>
> Without a token, GitHub allows only **60 requests per hour** — shared across your entire machine. A single run against a repo with 50+ issues will exhaust that quota immediately, locking you out for up to an hour. With a token, the limit rises to **5,000 requests per hour**, which is enough for any repo.
>
> See [Rate Limits & Authentication](#rate-limits--authentication) for full setup instructions.

---

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `<owner/repo>` | *(required)* | GitHub repository, e.g. `facebook/react` |
| `-o, --output <path>` | auto | Output file path. Defaults to `repissue-output.{md,txt,xml}` based on style |
| `--style <format>` | `markdown` | Output style: `markdown`, `plain`, or `xml` |
| `--token <token>` | `$GITHUB_TOKEN` | GitHub personal access token |
| `--no-issues` | — | Skip issues; output PRs only |
| `--no-prs` | — | Skip PRs; output issues only |
| `--include-merged-days <n>` | — | Also include PRs merged within the last N days |
| `--include-closed-days <n>` | — | Also include issues closed within the last N days |
| `--label-priority <labels>` | `bug,security,P0` | Comma-separated labels to float to the top |
| `--max-comments <n>` | `50` | Maximum comments to include per issue or PR |
| `--no-bots` | — | Filter out all bot-authored issues, PRs, and comments |
| `--header-text <text>` | — | Custom text embedded at the top of the output |
| `-c, --config <path>` | auto | Path to `repissue.config.json` |
| `--init` | — | Create a starter `repissue.config.json` in the current directory |
| `--stdout` | — | Print output to stdout instead of writing a file |
| `--append-to <file>` | — | Append the issues/PRs block to an existing file |
| `--split-output <bytes>` | — | Split output into multiple files if it exceeds N bytes |
| `--copy` | — | Copy output to clipboard after writing |
| `--security-check` | — | Warn if the output appears to contain secrets or credentials |
| `--quiet` | — | Suppress all output except errors |

### A few notes

**File extension auto-selection** — when `--output` is not specified, repissue picks the right extension for the chosen style: `.md` for markdown, `.txt` for plain, `.xml` for xml. If you pass `--output` explicitly, the extension is left as-is.

**`--append-to` and `--split-output`** cannot be combined with `--stdout`, and cannot be combined with each other.

**`--copy` with `--split-output`** — when output is split into multiple files, `--copy` is skipped with a warning.

---

## Configuration File

Run `repissue --init` to generate a starter config in the current directory:

```bash
npx repissue --init
```

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
| `fileSummary` | boolean | `true` | Include a short summary section at the top of the file |
| `headerText` | string | — | Optional custom text inserted at the very top |

#### `github`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | string | — | GitHub PAT. Prefer the `GITHUB_TOKEN` env var over storing a token in the file |
| `includeIssues` | boolean | `true` | Fetch and include open issues |
| `includePRs` | boolean | `true` | Fetch and include open pull requests |
| `includeMergedDays` | number | — | Include PRs merged within the last N days |
| `includeClosedDays` | number | — | Include issues closed within the last N days |
| `labelPriority` | string[] | `["bug","security","P0"]` | Labels whose items appear first. Order matters — first label = highest priority |
| `ignoreBots` | boolean | `true` | Filter out issues, PRs, and comments by bot accounts |
| `knownBots` | string[] | `["dependabot[bot]",…]` | Extra bot logins to filter. Any login ending in `[bot]` is always treated as a bot |
| `maxCommentsPerItem` | number | `50` | Maximum comments per issue or PR, after noise filtering |

#### `security`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableCheck` | boolean | `false` | Scan output for secret-like patterns and warn before writing |

---

## Output Styles

### `markdown` (default)

Structured Markdown with collapsible `<details>` blocks per issue and PR. Readable by humans, ideal for LLMs. Here's what the output looks like when rendered:

---

> **Example output** *(illustrative)*

#### 📋 repissue — `facebook/react`

| | |
|---|---|
| 🕐 **Generated** | 2026-04-03T14:22:00Z |
| 📁 **Repository** | [`facebook/react`](https://github.com/facebook/react) |
| 🐛 **Open Issues** | 47 |
| 🔀 **Open PRs** | 12 |

**🐛 Issues (47)**

<details>
<summary><strong>⚠️ <code>bug</code> &nbsp;#312</strong> — Auth token not refreshed on 401 &nbsp; <em>📅 2026-03-15 · 👤 alice · 💬 8</em></summary>

🔗 **URL:** https://github.com/facebook/react/issues/312
🔁 **Closes:** #318

When the access token expires mid-session, the client throws an unhandled promise rejection rather than refreshing…

#### 💬 Comments (3 shown, 5 filtered)

> 👤 **bob** · 📅 2026-03-16
>
> Confirmed on v2.x as well.

> 👤 **alice** · 📅 2026-03-17
>
> Root cause is in `refreshToken()` — the promise chain drops the error.

</details>

---

### `plain`

Plain text with ASCII dividers — no Markdown interpretation, safe for any toolchain.

```
📋 repissue — facebook/react
🕐 Generated : 2026-04-03T14:22:00Z
🐛 Issues    : 47 open
🔀 PRs       : 12 open

================================================================================
🐛 ISSUES (47)
================================================================================

  #312 — Auth token not refreshed on 401
  ⚠️ bug
  📅 Opened  : 2026-03-15
  👤 Author  : alice
  🔗 URL     : https://github.com/facebook/react/issues/312
```

### `xml`

Structured XML — well-suited for programmatic parsing and for feeding into tools that already consume XML (like Repomix's XML output).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<repissue>
  <metadata>
    <repository>facebook/react</repository>
    <open_issues>47</open_issues>
    <open_prs>12</open_prs>
  </metadata>
  <issues count="47">
    <issue number="312">
      <title>Auth token not refreshed on 401</title>
      ...
    </issue>
  </issues>
</repissue>
```

---

## Composing with Repomix

repissue is designed to be used alongside [Repomix](https://github.com/yamadashy/repomix). Repomix packs the *code*; repissue packs the *live project state*. Feed both to an agent for complete context.

### Two separate files

```bash
repomix
npx repissue owner/repo

claude --file repomix-output.xml --file repissue-output.xml \
  "Fix the bug described in issue #312"
```

### Appended into one file *(recommended for XML)*

The `--append-to` flag inserts a `<repissue_append>` block before the closing root tag of an existing XML file, keeping the document well-formed:

```bash
repomix                                                  # → repomix-output.xml
npx repissue owner/repo --append-to repomix-output.xml  # appends inside </repomix>

claude --file repomix-output.xml "Implement the feature in issue #88"
```

For Markdown, `--append-to` appends a `## repissue` section to the end of the file:

```bash
repomix --style markdown
npx repissue owner/repo --append-to repomix-output.md
```

---

## Using with AI Agents

### Claude

```bash
claude --file repissue-output.md "What are the most critical open bugs?"

# Combined with Repomix
repomix && npx repissue owner/repo --append-to repomix-output.xml
claude --file repomix-output.xml "Fix the highest-priority open issue"
```

### GitHub Actions

```yaml
- name: Generate issue context
  run: npx repissue ${{ github.repository }} --output repissue-output.md
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Run agent
  run: my-agent --context repissue-output.md
```

### Cursor / IDE chat

Drop `repissue-output.md` into your workspace and reference it in chat:

```
@repissue-output.md  What bugs are blocking the v2.0 release?
```

---

## Rate Limits & Authentication 🔑

| Mode | Limit | Reality |
|------|-------|---------|
| ❌ Unauthenticated | 60 requests / hour | Exhausted by a single mid-sized repo. Cooldown is up to **1 hour**. |
| ✅ Authenticated (`GITHUB_TOKEN`) | 5,000 requests / hour | Enough for any repo, including large ones with hundreds of issues. |

GitHub's unauthenticated limit is shared across all processes on your machine using the same IP address. Running repissue without a token against a repo with 50+ issues will hit the cap in seconds — and you won't be able to run it again until the hour resets. **A token is not optional in practice.**

### Setting up a token

**1. Create a token**

GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token.

- **Public repos:** no scopes needed.
- **Private repos:** select the `repo` scope.

**2. Set the environment variable**

```bash
# bash/zsh — add to ~/.bashrc or ~/.zshrc to make it permanent
export GITHUB_TOKEN=ghp_your_token_here
npx repissue owner/repo

# PowerShell
$env:GITHUB_TOKEN="ghp_your_token_here"
npx repissue owner/repo
```

You can also pass it inline for a one-off run, though the token will be visible in your process list:

```bash
GITHUB_TOKEN=ghp_xxx npx repissue owner/repo
```

Or store it in `repissue.config.json` — though the env var is strongly preferred to avoid accidentally committing credentials.

### What happens when the limit is hit

repissue automatically waits and retries up to 3 times using the reset time from GitHub's response headers. If all retries are exhausted, it exits with a clear error message telling you exactly when the limit resets.

---

## Security Scanning

Enable with `--security-check` or in your config:

```json
{ "security": { "enableCheck": true } }
```

Detected patterns include: GitHub tokens, AWS access keys, API secret keys (`sk-` prefix), PEM private key headers, Slack tokens, Stripe keys, SendGrid API keys, and generic `password`/`secret` assignments.

> **Note:** repissue always writes the output file regardless of scan hits. It warns you so you can review and rotate credentials — it does not block or redact content.

---

## License

MIT License