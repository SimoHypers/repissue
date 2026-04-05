export const plainTemplate = `repissue Output
{{#if headerText}}
{{headerText}}
{{/if}}
Generated: {{generatedAt}}
Repository: {{repo}}
Open Issues: {{issueCount}} | Open PRs: {{prCount}}

================================================================================
{{#if issues}}
OPEN ISSUES ({{issueCount}})
================================================================================

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
================================================================================

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