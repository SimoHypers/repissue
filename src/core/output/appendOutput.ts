import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import { registerHelpers } from './outputStyleUtils.js';
import type { OutputContext } from './outputGeneratorTypes.js';
import { RepissueError } from '../../shared/errorHandle.js';

// ── Append-only templates ──────────────────────────────────────────────────
//
// These templates render only the issues/PRs sections — no file header,
// no metadata preamble. They are designed to slot cleanly onto the end of
// an existing Repomix (or other) output file.

const MARKDOWN_APPEND_TEMPLATE = `
---

## repissue — Issues & PRs for \`{{repo}}\`

> **Appended:** {{generatedAt}}
> **Open Issues:** {{issueCount}} | **Open PRs:** {{prCount}}

{{#if issues}}
### Open Issues ({{issueCount}})

{{#each issues}}
#### {{labelBadges this.issue.labels}}#{{this.issue.number}} — {{this.issue.title}}

**Opened:** {{formatDate this.issue.created_at}} | **Author:** {{userLogin this.issue.user}} | **Comments:** {{this.issue.comments}}
{{#if this.crossRefs.closes}}
**Linked PRs / Closes:** {{joinNumbers this.crossRefs.closes}}
{{/if}}
{{#if this.crossRefs.mentions}}
**Mentions:** {{joinNumbers this.crossRefs.mentions}}
{{/if}}

{{#if this.issue.body}}
{{truncate this.issue.body 1000}}
{{/if}}

{{#if this.comments}}
**Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered as noise{{/if}}):**

{{#each this.comments}}
- **{{userLogin this.user}}** ({{formatDate this.created_at}}): {{truncate this.body 500}}
{{/each}}
{{/if}}

---

{{/each}}
{{/if}}
{{#if prs}}
### Open Pull Requests ({{prCount}})

{{#each prs}}
#### #{{this.pr.number}} — {{this.pr.title}}{{#if this.pr.draft}} [draft]{{/if}}

**Author:** {{userLogin this.pr.user}} | **Base:** {{this.pr.base.ref}} | **Updated:** {{formatDate this.pr.updated_at}}
**Changed files:** {{this.pr.changed_files}} | **+{{this.pr.additions}} / -{{this.pr.deletions}}**
{{#if this.crossRefs.closes}}
**Closes:** {{joinNumbers this.crossRefs.closes}}
{{/if}}
{{#if this.pr.labels}}
**Labels:** {{labelBadges this.pr.labels}}
{{/if}}

{{#if this.pr.body}}
{{truncate this.pr.body 1000}}
{{/if}}

{{#if this.comments}}
**Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered as noise{{/if}}):**

{{#each this.comments}}
- **{{userLogin this.user}}** ({{formatDate this.created_at}}): {{truncate this.body 500}}
{{/each}}
{{/if}}

---

{{/each}}
{{/if}}
`;

const PLAIN_APPEND_TEMPLATE = `

================================================================================
repissue — Issues & PRs for {{repo}}
Appended: {{generatedAt}}
Open Issues: {{issueCount}} | Open PRs: {{prCount}}
================================================================================

{{#if issues}}
OPEN ISSUES ({{issueCount}})
--------------------------------------------------------------------------------

{{#each issues}}
[{{labelNames this.issue.labels}}] #{{this.issue.number}} — {{this.issue.title}}
Opened: {{formatDate this.issue.created_at}} | Author: {{userLogin this.issue.user}} | Comments: {{this.issue.comments}}
{{#if this.crossRefs.closes}}Closes: {{joinNumbers this.crossRefs.closes}}{{/if}}

{{#if this.issue.body}}
{{truncate this.issue.body 1000}}
{{/if}}

{{#if this.comments}}
Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered{{/if}}):
{{#each this.comments}}
  [{{formatDate this.created_at}}] {{userLogin this.user}}: {{truncate this.body 500}}
{{/each}}
{{/if}}

--------------------------------------------------------------------------------

{{/each}}
{{/if}}
{{#if prs}}
OPEN PULL REQUESTS ({{prCount}})
--------------------------------------------------------------------------------

{{#each prs}}
#{{this.pr.number}} — {{this.pr.title}}{{#if this.pr.draft}} [DRAFT]{{/if}}
Author: {{userLogin this.pr.user}} | Base: {{this.pr.base.ref}} | +{{this.pr.additions}} / -{{this.pr.deletions}}
{{#if this.crossRefs.closes}}Closes: {{joinNumbers this.crossRefs.closes}}{{/if}}

{{#if this.pr.body}}
{{truncate this.pr.body 1000}}
{{/if}}

{{#if this.comments}}
Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered{{/if}}):
{{#each this.comments}}
  [{{formatDate this.created_at}}] {{userLogin this.user}}: {{truncate this.body 500}}
{{/each}}
{{/if}}

--------------------------------------------------------------------------------

{{/each}}
{{/if}}
`;

const XML_APPEND_TEMPLATE = `
  <repissue_append>
    <metadata>
      <appended_at>{{generatedAt}}</appended_at>
      <repository>{{repo}}</repository>
      <open_issues>{{issueCount}}</open_issues>
      <open_prs>{{prCount}}</open_prs>
    </metadata>
{{#if issues}}
    <issues count="{{issueCount}}">
{{#each issues}}
      <issue number="{{this.issue.number}}">
        <title>{{xmlEscape this.issue.title}}</title>
        <state>{{this.issue.state}}</state>
        <author>{{userLogin this.issue.user}}</author>
        <created_at>{{this.issue.created_at}}</created_at>
        <updated_at>{{this.issue.updated_at}}</updated_at>
        <comment_count>{{this.issue.comments}}</comment_count>
        <url>{{this.issue.html_url}}</url>
        {{#if this.issue.labels}}
        <labels>{{#each this.issue.labels}}<label>{{xmlEscape this.name}}</label>{{/each}}</labels>
        {{/if}}
        {{#if this.crossRefs.closes}}
        <closes>{{#each this.crossRefs.closes}}<ref>{{this}}</ref>{{/each}}</closes>
        {{/if}}
        {{#if this.crossRefs.mentions}}
        <mentions>{{#each this.crossRefs.mentions}}<ref>{{this}}</ref>{{/each}}</mentions>
        {{/if}}
        {{#if this.issue.body}}
        <body>{{xmlEscape (truncate this.issue.body 1000)}}</body>
        {{/if}}
        {{#if this.comments}}
        <comments shown="{{this.comments.length}}" filtered="{{this.filteredCommentCount}}">
{{#each this.comments}}
          <comment id="{{this.id}}">
            <author>{{userLogin this.user}}</author>
            <created_at>{{this.created_at}}</created_at>
            <body>{{xmlEscape (truncate this.body 500)}}</body>
          </comment>
{{/each}}
        </comments>
        {{/if}}
      </issue>
{{/each}}
    </issues>
{{/if}}
{{#if prs}}
    <pull_requests count="{{prCount}}">
{{#each prs}}
      <pull_request number="{{this.pr.number}}">
        <title>{{xmlEscape this.pr.title}}</title>
        <state>{{this.pr.state}}</state>
        <draft>{{this.pr.draft}}</draft>
        <author>{{userLogin this.pr.user}}</author>
        <base_branch>{{this.pr.base.ref}}</base_branch>
        <head_branch>{{this.pr.head.ref}}</head_branch>
        <additions>{{this.pr.additions}}</additions>
        <deletions>{{this.pr.deletions}}</deletions>
        <changed_files>{{this.pr.changed_files}}</changed_files>
        <created_at>{{this.pr.created_at}}</created_at>
        <updated_at>{{this.pr.updated_at}}</updated_at>
        <url>{{this.pr.html_url}}</url>
        {{#if this.pr.labels}}
        <labels>{{#each this.pr.labels}}<label>{{xmlEscape this.name}}</label>{{/each}}</labels>
        {{/if}}
        {{#if this.crossRefs.closes}}
        <closes>{{#each this.crossRefs.closes}}<ref>{{this}}</ref>{{/each}}</closes>
        {{/if}}
        {{#if this.pr.body}}
        <body>{{xmlEscape (truncate this.pr.body 1000)}}</body>
        {{/if}}
        {{#if this.comments}}
        <comments shown="{{this.comments.length}}" filtered="{{this.filteredCommentCount}}">
{{#each this.comments}}
          <comment id="{{this.id}}">
            <author>{{userLogin this.user}}</author>
            <created_at>{{this.created_at}}</created_at>
            <body>{{xmlEscape (truncate this.body 500)}}</body>
          </comment>
{{/each}}
        </comments>
        {{/if}}
      </pull_request>
{{/each}}
    </pull_requests>
{{/if}}
  </repissue_append>
`;

// ── Style detection ────────────────────────────────────────────────────────

type AppendStyle = 'markdown' | 'plain' | 'xml';

const TEMPLATE_MAP: Record<AppendStyle, string> = {
  markdown: MARKDOWN_APPEND_TEMPLATE,
  plain: PLAIN_APPEND_TEMPLATE,
  xml: XML_APPEND_TEMPLATE,
};

/**
 * Resolve which append style to use.
 *
 * Priority order:
 *   1. Explicit --style flag (user knows what they want)
 *   2. Target file extension (.xml → xml, everything else → markdown)
 *   3. Fallback: markdown
 */
export const resolveAppendStyle = (
  filePath: string,
  explicitStyle?: 'markdown' | 'plain' | 'xml',
): AppendStyle => {
  if (explicitStyle !== undefined) return explicitStyle;
  return path.extname(filePath).toLowerCase() === '.xml' ? 'xml' : 'markdown';
};

// ── Block generation ───────────────────────────────────────────────────────

/**
 * Render a self-contained issues/PRs block suitable for appending to an
 * existing file. Does not include the full repissue file header or metadata
 * preamble — only the sections that add value when composed with another tool's
 * output (e.g. Repomix).
 */
export const generateAppendBlock = (context: OutputContext, style: AppendStyle): string => {
  registerHelpers();

  const templateSource = TEMPLATE_MAP[style];
  const template = Handlebars.compile(templateSource, { noEscape: true });

  return template({
    repo: context.repo,
    generatedAt: context.generatedAt,
    issues: context.issues,
    prs: context.prs,
    issueCount: context.issues.length,
    prCount: context.prs.length,
  });
};

// ── File append ────────────────────────────────────────────────────────────

/**
 * Append a repissue issues/PRs block to an existing file.
 *
 * Behaviour:
 * - The target file MUST already exist. We refuse to create it from scratch
 *   to avoid accidentally overwriting a non-existent path the user mistyped.
 * - For XML targets: the block is inserted before the closing root tag if one
 *   is found, so the result stays valid XML. If no closing tag is detected
 *   the block is appended at the end (safe fallback).
 * - For Markdown/plain targets: the block is appended at the end.
 */
export const appendToFile = async (
  targetPath: string,
  context: OutputContext,
  style: AppendStyle,
): Promise<void> => {
  if (!existsSync(targetPath)) {
    throw new RepissueError(
      `--append-to target does not exist: ${targetPath}\n` +
      `Create the file first, or run without --append-to to write a new repissue output file.`,
    );
  }

  const block = generateAppendBlock(context, style);

  if (style === 'xml') {
    await appendXml(targetPath, block);
  } else {
    // Markdown and plain: straightforward append
    const existing = await readFile(targetPath, 'utf-8');
    // Ensure there is exactly one newline between existing content and the block
    const separator = existing.endsWith('\n') ? '' : '\n';
    await writeFile(targetPath, existing + separator + block, 'utf-8');
  }
};

/**
 * For XML files: insert the append block before the closing root element tag
 * so the resulting document stays well-formed.
 *
 * Heuristic: find the LAST closing tag (</word>) in the file — this is almost
 * always the document root. If none is found, fall back to plain append.
 */
const appendXml = async (targetPath: string, block: string): Promise<void> => {
  const existing = await readFile(targetPath, 'utf-8');

  // Match the last closing XML tag in the document
  const lastClosingTagMatch = existing.match(/(<\/\w[\w.-]*>\s*)$/);

  if (lastClosingTagMatch) {
    const insertionIndex = existing.lastIndexOf(lastClosingTagMatch[0]);
    const before = existing.slice(0, insertionIndex);
    const after = existing.slice(insertionIndex);
    await writeFile(targetPath, before + block + '\n' + after, 'utf-8');
  } else {
    // No closing root tag found — plain append as safe fallback
    const separator = existing.endsWith('\n') ? '' : '\n';
    await writeFile(targetPath, existing + separator + block, 'utf-8');
  }
};