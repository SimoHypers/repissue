export const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<repissue>
  <metadata>
    <generated_at>{{generatedAt}}</generated_at>
    <repository>{{repo}}</repository>
    <open_issues>{{issueCount}}</open_issues>
    <open_prs>{{prCount}}</open_prs>
    {{#if headerText}}<header>{{xmlEscape headerText}}</header>{{/if}}
  </metadata>
{{#if fileSummary}}
  <file_summary>
    This file is a packed snapshot of open issues and pull requests for {{repo}},
    designed to be consumed by AI systems.
  </file_summary>
{{/if}}
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
</repissue>
`;