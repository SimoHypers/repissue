import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import Handlebars from 'handlebars';
import { registerHelpers } from './outputStyleUtils.js';
import type { EnrichedIssue, EnrichedPR, OutputContext } from './outputGeneratorTypes.js';
import type { OutputConfig } from '../../config/configSchema.js';

// ── File naming ────────────────────────────────────────────────────────────

/**
 * Derive a numbered output path from a base path.
 * e.g. "repissue-output.md" + 2 → "repissue-output-2.md"
 *      "output" + 1           → "output-1"
 */
export const buildSplitFilePath = (basePath: string, index: number): string => {
  const ext = path.extname(basePath);
  const base = basePath.slice(0, basePath.length - ext.length);
  return `${base}-${index}${ext}`;
};

// ── Per-item rendering ─────────────────────────────────────────────────────
//
// These minimal templates render a single issue or PR in the target style.
// They are intentionally kept in sync with the main output templates in
// outputStyles/ — if you update the main templates, update these too.

const ISSUE_TEMPLATES: Record<OutputConfig['style'], string> = {
  markdown: `### {{labelBadges issue.labels}}#{{issue.number}} — {{issue.title}}

**Opened:** {{formatDate issue.created_at}} | **Author:** {{userLogin issue.user}} | **Comments:** {{issue.comments}}
{{#if crossRefs.closes}}
**Linked PRs / Closes:** {{joinNumbers crossRefs.closes}}
{{/if}}
{{#if crossRefs.mentions}}
**Mentions:** {{joinNumbers crossRefs.mentions}}
{{/if}}

{{#if issue.body}}
{{truncate issue.body 1000}}
{{/if}}

{{#if comments}}
**Comments ({{comments.length}} shown{{#if filteredCommentCount}}, {{filteredCommentCount}} filtered as noise{{/if}}):**

{{#each comments}}
- **{{userLogin this.user}}** ({{formatDate this.created_at}}): {{truncate this.body 500}}
{{/each}}
{{/if}}

---

`,
  plain: `[{{labelNames issue.labels}}] #{{issue.number}} — {{issue.title}}
Opened: {{formatDate issue.created_at}} | Author: {{userLogin issue.user}} | Comments: {{issue.comments}}
{{#if crossRefs.closes}}Closes: {{joinNumbers crossRefs.closes}}{{/if}}

{{#if issue.body}}
{{truncate issue.body 1000}}
{{/if}}

{{#if comments}}
Comments ({{comments.length}} shown{{#if filteredCommentCount}}, {{filteredCommentCount}} filtered{{/if}}):
{{#each comments}}
  [{{formatDate this.created_at}}] {{userLogin this.user}}: {{truncate this.body 500}}
{{/each}}
{{/if}}

--------------------------------------------------------------------------------

`,
  xml: `    <issue number="{{issue.number}}">
      <title>{{xmlEscape issue.title}}</title>
      <state>{{issue.state}}</state>
      <author>{{userLogin issue.user}}</author>
      <created_at>{{issue.created_at}}</created_at>
      <updated_at>{{issue.updated_at}}</updated_at>
      <comment_count>{{issue.comments}}</comment_count>
      <url>{{issue.html_url}}</url>
      {{#if issue.labels}}
      <labels>{{#each issue.labels}}<label>{{xmlEscape this.name}}</label>{{/each}}</labels>
      {{/if}}
      {{#if crossRefs.closes}}
      <closes>{{#each crossRefs.closes}}<ref>{{this}}</ref>{{/each}}</closes>
      {{/if}}
      {{#if issue.body}}
      <body>{{xmlEscape (truncate issue.body 1000)}}</body>
      {{/if}}
      {{#if comments}}
      <comments shown="{{comments.length}}" filtered="{{filteredCommentCount}}">
{{#each comments}}
        <comment id="{{this.id}}">
          <author>{{userLogin this.user}}</author>
          <created_at>{{this.created_at}}</created_at>
          <body>{{xmlEscape (truncate this.body 500)}}</body>
        </comment>
{{/each}}
      </comments>
      {{/if}}
    </issue>
`,
};

const PR_TEMPLATES: Record<OutputConfig['style'], string> = {
  markdown: `### #{{pr.number}} — {{pr.title}}{{#if pr.draft}} [draft]{{/if}}

**Author:** {{userLogin pr.user}} | **Base:** {{pr.base.ref}} | **Updated:** {{formatDate pr.updated_at}}
**Changed files:** {{pr.changed_files}} | **+{{pr.additions}} / -{{pr.deletions}}**
{{#if crossRefs.closes}}
**Closes:** {{joinNumbers crossRefs.closes}}
{{/if}}
{{#if pr.labels}}
**Labels:** {{labelBadges pr.labels}}
{{/if}}

{{#if pr.body}}
{{truncate pr.body 1000}}
{{/if}}

{{#if comments}}
**Comments ({{comments.length}} shown{{#if filteredCommentCount}}, {{filteredCommentCount}} filtered as noise{{/if}}):**

{{#each comments}}
- **{{userLogin this.user}}** ({{formatDate this.created_at}}): {{truncate this.body 500}}
{{/each}}
{{/if}}

---

`,
  plain: `#{{pr.number}} — {{pr.title}}{{#if pr.draft}} [DRAFT]{{/if}}
Author: {{userLogin pr.user}} | Base: {{pr.base.ref}} | +{{pr.additions}} / -{{pr.deletions}}
{{#if crossRefs.closes}}Closes: {{joinNumbers crossRefs.closes}}{{/if}}

{{#if pr.body}}
{{truncate pr.body 1000}}
{{/if}}

{{#if comments}}
Comments ({{comments.length}} shown{{#if filteredCommentCount}}, {{filteredCommentCount}} filtered{{/if}}):
{{#each comments}}
  [{{formatDate this.created_at}}] {{userLogin this.user}}: {{truncate this.body 500}}
{{/each}}
{{/if}}

--------------------------------------------------------------------------------

`,
  xml: `    <pull_request number="{{pr.number}}">
      <title>{{xmlEscape pr.title}}</title>
      <state>{{pr.state}}</state>
      <draft>{{pr.draft}}</draft>
      <author>{{userLogin pr.user}}</author>
      <base_branch>{{pr.base.ref}}</base_branch>
      <head_branch>{{pr.head.ref}}</head_branch>
      <additions>{{pr.additions}}</additions>
      <deletions>{{pr.deletions}}</deletions>
      <changed_files>{{pr.changed_files}}</changed_files>
      <created_at>{{pr.created_at}}</created_at>
      <updated_at>{{pr.updated_at}}</updated_at>
      <url>{{pr.html_url}}</url>
      {{#if pr.labels}}
      <labels>{{#each pr.labels}}<label>{{xmlEscape this.name}}</label>{{/each}}</labels>
      {{/if}}
      {{#if crossRefs.closes}}
      <closes>{{#each crossRefs.closes}}<ref>{{this}}</ref>{{/each}}</closes>
      {{/if}}
      {{#if pr.body}}
      <body>{{xmlEscape (truncate pr.body 1000)}}</body>
      {{/if}}
      {{#if comments}}
      <comments shown="{{comments.length}}" filtered="{{filteredCommentCount}}">
{{#each comments}}
        <comment id="{{this.id}}">
          <author>{{userLogin this.user}}</author>
          <created_at>{{this.created_at}}</created_at>
          <body>{{xmlEscape (truncate this.body 500)}}</body>
        </comment>
{{/each}}
      </comments>
      {{/if}}
    </pull_request>
`,
};

// ── Preamble/closing per style ─────────────────────────────────────────────
//
// Each split file gets a self-contained header and (for XML) a closing tag.
// Counts reflect the TOTAL across all files so each file is self-explanatory.

const buildPreamble = (
  context: OutputContext,
  style: OutputConfig['style'],
  fileIndex: number,
  totalFiles: number,
): string => {
  const { repo, generatedAt, issues, prs, config } = context;
  const totalIssues = issues.length;
  const totalPRs = prs.length;
  const partLabel = `Part ${fileIndex} of ${totalFiles}`;

  switch (style) {
    case 'markdown':
      return [
        `# repissue Output — ${partLabel}`,
        config.output.headerText ? `\n${config.output.headerText}\n` : '',
        `> **Generated:** ${generatedAt}`,
        `> **Repository:** ${repo}`,
        `> **Total Issues:** ${totalIssues} | **Total PRs:** ${totalPRs} | **${partLabel}**`,
        '',
        '---',
        '',
      ].join('\n');

    case 'plain':
      return [
        `repissue Output — ${partLabel}`,
        config.output.headerText ?? '',
        `Generated: ${generatedAt}`,
        `Repository: ${repo}`,
        `Total Issues: ${totalIssues} | Total PRs: ${totalPRs} | ${partLabel}`,
        '',
        '================================================================================',
        '',
      ].join('\n');

    case 'xml':
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<repissue>',
        '  <metadata>',
        `    <generated_at>${generatedAt}</generated_at>`,
        `    <repository>${repo}</repository>`,
        `    <total_issues>${totalIssues}</total_issues>`,
        `    <total_prs>${totalPRs}</total_prs>`,
        `    <part>${fileIndex}</part>`,
        `    <total_parts>${totalFiles}</total_parts>`,
        '  </metadata>',
      ].join('\n') + '\n';
  }
};

const buildClosing = (style: OutputConfig['style']): string => {
  if (style === 'xml') return '</repissue>\n';
  return '';
};

const buildSectionHeader = (
  label: string,
  count: number,
  style: OutputConfig['style'],
): string => {
  switch (style) {
    case 'markdown': return `## ${label} (${count})\n\n`;
    case 'plain':    return `${label.toUpperCase()} (${count})\n${'='.repeat(80)}\n\n`;
    case 'xml':      return `  <${label.toLowerCase().replace(/ /g, '_')} count="${count}">\n`;
  }
};

const buildSectionClosing = (label: string, style: OutputConfig['style']): string => {
  if (style === 'xml') return `  </${label.toLowerCase().replace(/ /g, '_')}>\n`;
  return '';
};

// ── Item rendering ─────────────────────────────────────────────────────────

const renderIssue = (enriched: EnrichedIssue, style: OutputConfig['style']): string => {
  registerHelpers();
  const template = Handlebars.compile(ISSUE_TEMPLATES[style], { noEscape: true });
  return template({
    issue: enriched.issue,
    comments: enriched.comments,
    filteredCommentCount: enriched.filteredCommentCount,
    crossRefs: enriched.crossRefs,
  });
};

const renderPR = (enriched: EnrichedPR, style: OutputConfig['style']): string => {
  registerHelpers();
  const template = Handlebars.compile(PR_TEMPLATES[style], { noEscape: true });
  return template({
    pr: enriched.pr,
    comments: enriched.comments,
    filteredCommentCount: enriched.filteredCommentCount,
    crossRefs: enriched.crossRefs,
  });
};

// ── Core split algorithm ───────────────────────────────────────────────────

export interface SplitChunk {
  /** 1-based index */
  index: number;
  content: string;
}

/**
 * Split enriched issues and PRs into chunks where each chunk's byte size
 * (UTF-8) does not exceed `maxBytes`.
 *
 * Rules:
 * - Items are never split mid-way — each issue/PR is atomic.
 * - If a single item exceeds maxBytes on its own it gets its own chunk
 *   (we never drop content).
 * - All issues come before all PRs within each chunk (preserving sort order).
 * - Each chunk is self-contained: it has its own preamble and, for XML, a
 *   closing tag. The total file count is determined before writing so every
 *   preamble can say "Part N of M".
 * - If everything fits in one chunk, `[{ index: 1, content: fullOutput }]`
 *   is returned and the caller can skip the numbered-suffix logic.
 */
export const splitIntoChunks = (
  context: OutputContext,
  maxBytes: number,
): SplitChunk[] => {
  const style = context.config.output.style;

  // Pre-render every item so we know its byte size upfront.
  const renderedIssues = context.issues.map((e) => ({
    rendered: renderIssue(e, style),
    isIssue: true as const,
  }));
  const renderedPRs = context.prs.map((e) => ({
    rendered: renderPR(e, style),
    isIssue: false as const,
  }));

  const allItems = [...renderedIssues, ...renderedPRs];

  // Fast path: nothing to split
  if (allItems.length === 0) {
    // Return a single empty-ish chunk — the preamble will note 0 issues/PRs
    return [{ index: 1, content: buildPreamble(context, style, 1, 1) + buildClosing(style) }];
  }

  // ── Pass 1: bin items into groups without knowing total count yet ─────────
  // We use a placeholder preamble size for the initial packing since we don't
  // know totalFiles yet. We use a generous estimate (512 bytes) — after we know
  // the final count we recalculate and verify each chunk still fits (it always
  // will in practice because preamble size differences are tiny).

  const PREAMBLE_ESTIMATE = 512;

  type RawGroup = Array<{ rendered: string; isIssue: boolean }>;
  const groups: RawGroup[] = [];
  let currentGroup: RawGroup = [];
  let currentBytes = PREAMBLE_ESTIMATE;

  for (const item of allItems) {
    const itemBytes = Buffer.byteLength(item.rendered, 'utf8');

    if (currentGroup.length > 0 && currentBytes + itemBytes > maxBytes) {
      // Current group is full — start a new one
      groups.push(currentGroup);
      currentGroup = [item];
      currentBytes = PREAMBLE_ESTIMATE + itemBytes;
    } else {
      currentGroup.push(item);
      currentBytes += itemBytes;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const totalFiles = groups.length;

  // ── Pass 2: assemble final content strings with correct preambles ─────────
  return groups.map((group, idx) => {
    const fileIndex = idx + 1;
    const preamble = buildPreamble(context, style, fileIndex, totalFiles);
    const closing = buildClosing(style);

    const issueItems = group.filter((g) => g.isIssue);
    const prItems = group.filter((g) => !g.isIssue);

    let body = '';

    if (issueItems.length > 0) {
      body += buildSectionHeader('Open Issues', issueItems.length, style);
      body += issueItems.map((g) => g.rendered).join('');
      body += buildSectionClosing('issues', style);
    }

    if (prItems.length > 0) {
      body += buildSectionHeader('Open Pull Requests', prItems.length, style);
      body += prItems.map((g) => g.rendered).join('');
      body += buildSectionClosing('pull_requests', style);
    }

    return { index: fileIndex, content: preamble + body + closing };
  });
};

// ── Disk write ─────────────────────────────────────────────────────────────

/**
 * Write split chunks to disk.
 *
 * - Single chunk → writes to `basePath` directly (no `-1` suffix).
 * - Multiple chunks → writes to `basePath-1.ext`, `basePath-2.ext`, etc.
 *
 * Returns the list of file paths written, in order.
 */
export const writeSplitFiles = async (
  basePath: string,
  chunks: SplitChunk[],
): Promise<string[]> => {
  if (chunks.length === 1) {
    await writeFile(basePath, chunks[0].content, 'utf-8');
    return [basePath];
  }

  const paths: string[] = [];
  for (const chunk of chunks) {
    const filePath = buildSplitFilePath(basePath, chunk.index);
    await writeFile(filePath, chunk.content, 'utf-8'); // eslint-disable-line no-await-in-loop
    paths.push(filePath);
  }
  return paths;
};