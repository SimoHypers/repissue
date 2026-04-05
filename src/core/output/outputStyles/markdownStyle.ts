// Handlebars template for markdown output style.
// Kept as a plain string (not a .hbs file) so it ships inside the compiled JS
// with no extra file I/O at runtime.

export const markdownTemplate = `# repissue Output
{{#if headerText}}
{{headerText}}

{{/if}}
> **Generated:** {{generatedAt}}
> **Repository:** {{repo}}
> **Open Issues:** {{issueCount}} | **Open PRs:** {{prCount}}

---

{{#if fileSummary}}
## File Summary

This file is a packed snapshot of open issues and pull requests for \`{{repo}}\`,
designed to be consumed by AI systems. Feed it alongside a Repomix code context
file for full repository awareness.

---

{{/if}}
{{#if issues}}
## Open Issues ({{issueCount}})

{{#each issues}}
### {{labelBadges this.issue.labels}}#{{this.issue.number}} — {{this.issue.title}}

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
## Open Pull Requests ({{prCount}})

{{#each prs}}
### #{{this.pr.number}} — {{this.pr.title}}{{#if this.pr.draft}} [draft]{{/if}}

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