// Handlebars template for markdown output style.
// Kept as a plain string (not a .hbs file) so it ships inside the compiled JS
// with no extra file I/O at runtime.

export const markdownTemplate = `# 📋 repissue — \`{{repo}}\`
{{#if headerText}}
> {{headerText}}
>
{{/if}}
| | |
|---|---|
| 🕐 **Generated** | {{generatedAt}} |
| 📁 **Repository** | [\`{{repo}}\`](https://github.com/{{repo}}) |
| 🐛 **Open Issues** | {{issueCount}} |
| 🔀 **Open PRs** | {{prCount}} |

{{#if fileSummary}}
> 📦 **What is this file?** A packed snapshot of open issues and pull requests for \`{{repo}}\`,
> structured for AI consumption. Feed it alongside a Repomix code snapshot for complete
> repository awareness.

{{/if}}
---
{{#if issues}}

## 🐛 Issues ({{issueCount}})

{{#each issues}}
<details>
<summary><strong>{{labelBadges this.issue.labels}}#{{this.issue.number}}</strong> — {{this.issue.title}} &nbsp; <em>📅 {{formatDate this.issue.created_at}} · 👤 {{userLogin this.issue.user}} · 💬 {{this.issue.comments}}</em></summary>

🔗 **URL:** https://github.com/{{../repo}}/issues/{{this.issue.number}}
{{#if this.crossRefs.closes}}
🔁 **Closes:** {{joinNumbers this.crossRefs.closes}}
{{/if}}
{{#if this.crossRefs.mentions}}
👀 **Mentions:** {{joinNumbers this.crossRefs.mentions}}
{{/if}}

---

{{#if this.issue.body}}
{{stripImages (truncate this.issue.body 2000)}}
{{/if}}
{{#if this.comments}}

#### 💬 Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered{{/if}})

{{#each this.comments}}
> 👤 **{{userLogin this.user}}** · 📅 {{formatDate this.created_at}}
>
> {{stripImages (truncate this.body 600)}}

{{/each}}
{{/if}}

</details>

{{/each}}
{{/if}}
{{#if prs}}

---

## 🔀 Pull Requests ({{prCount}})

{{#each prs}}
<details>
<summary>{{#if this.pr.draft}}🚧{{else}}🟢{{/if}} <strong>#{{this.pr.number}}</strong> — {{this.pr.title}}{{#if this.pr.draft}} <em>[draft]</em>{{/if}} &nbsp; <em>👤 {{userLogin this.pr.user}} · 📅 {{formatDate this.pr.updated_at}}</em></summary>

🔗 **URL:** https://github.com/{{../repo}}/pull/{{this.pr.number}}
🌿 **Branch:** \`{{this.pr.base.ref}}\` ← \`{{this.pr.head.ref}}\`
📊 **Diff:** ➕{{this.pr.additions}} ➖{{this.pr.deletions}} across 📄 {{this.pr.changed_files}} file(s)
{{#if this.pr.labels}}
🏷️ **Labels:** {{labelBadges this.pr.labels}}
{{/if}}
{{#if this.crossRefs.closes}}
🔁 **Closes:** {{joinNumbers this.crossRefs.closes}}
{{/if}}

---

{{#if this.pr.body}}
{{stripImages (truncate this.pr.body 2000)}}
{{/if}}
{{#if this.comments}}

#### 💬 Comments ({{this.comments.length}} shown{{#if this.filteredCommentCount}}, {{this.filteredCommentCount}} filtered{{/if}})

{{#each this.comments}}
> 👤 **{{userLogin this.user}}** · 📅 {{formatDate this.created_at}}
>
> {{stripImages (truncate this.body 600)}}

{{/each}}
{{/if}}

</details>

{{/each}}
{{/if}}
`;