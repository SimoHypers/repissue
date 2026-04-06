export const plainTemplate = `📋 repissue — {{repo}}
{{#if headerText}}
{{headerText}}
{{/if}}
🕐 Generated : {{generatedAt}}
📁 Repository: {{repo}}
🐛 Issues    : {{issueCount}} open
🔀 PRs       : {{prCount}} open

================================================================================
{{#if issues}}
🐛 ISSUES ({{issueCount}})
================================================================================

{{#each issues}}
  #{{this.issue.number}} — {{this.issue.title}}
  🏷️  {{labelNames this.issue.labels}}
  📅 Opened  : {{formatDate this.issue.created_at}}
  👤 Author  : {{userLogin this.issue.user}}
  🔗 URL     : https://github.com/{{../repo}}/issues/{{this.issue.number}}
  💬 Comments: {{this.issue.comments}}
{{#if this.crossRefs.closes}}
  🔁 Closes  : {{joinNumbers this.crossRefs.closes}}
{{/if}}
{{#if this.crossRefs.mentions}}
  👀 Mentions: {{joinNumbers this.crossRefs.mentions}}
{{/if}}

{{#if this.issue.body}}
{{stripImages (truncate this.issue.body 2000)}}
{{/if}}
{{#if this.comments}}
  💬 Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered{{/if}})
{{#each this.comments}}
  👤 [{{formatDate this.created_at}}] {{userLogin this.user}}:
  {{stripImages (truncate this.body 600)}}

{{/each}}
{{/if}}

--------------------------------------------------------------------------------

{{/each}}
{{/if}}
{{#if prs}}
🔀 PULL REQUESTS ({{prCount}})
================================================================================

{{#each prs}}
  {{#if this.pr.draft}}🚧{{else}}🟢{{/if}} #{{this.pr.number}} — {{this.pr.title}}{{#if this.pr.draft}} [DRAFT]{{/if}}
  👤 Author  : {{userLogin this.pr.user}}
  🌿 Branch  : {{this.pr.base.ref}} ← {{this.pr.head.ref}}
{{#if this.pr.changed_files}}
  📊 Diff    : ➕{{this.pr.additions}} ➖{{this.pr.deletions}} ({{this.pr.changed_files}} files)
{{/if}}
  📅 Updated : {{formatDate this.pr.updated_at}}
  🔗 URL     : https://github.com/{{../repo}}/pull/{{this.pr.number}}
{{#if this.pr.labels}}
  🏷️  Labels  : {{labelNames this.pr.labels}}
{{/if}}
{{#if this.crossRefs.closes}}
  🔁 Closes  : {{joinNumbers this.crossRefs.closes}}
{{/if}}

{{#if this.pr.body}}
{{stripImages (truncate this.pr.body 2000)}}
{{/if}}
{{#if this.comments}}
  💬 Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered{{/if}})
{{#each this.comments}}
  👤 [{{formatDate this.created_at}}] {{userLogin this.user}}:
  {{stripImages (truncate this.body 600)}}

{{/each}}
{{/if}}

--------------------------------------------------------------------------------

{{/each}}
{{/if}}
`;