import { z } from 'zod';

export const githubUserSchema = z.object({
  login: z.string(),
  type: z.string(),
});

export const githubLabelSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
});

export const githubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  labels: z.array(githubLabelSchema),
  user: githubUserSchema.nullable(),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  // Present only when this item is actually a PR — used to filter them out
  pull_request: z.object({ url: z.string() }).optional(),
  html_url: z.string(),
});

export const githubPRSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  draft: z.boolean(),
  labels: z.array(githubLabelSchema),
  user: githubUserSchema.nullable(),
  base: z.object({ ref: z.string() }),
  head: z.object({ ref: z.string() }),
  additions: z.number().optional().default(0),
  deletions: z.number().optional().default(0),
  changed_files: z.number().optional().default(0),
  merged_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string(),
});

export const githubCommentSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  user: githubUserSchema.nullable(),
  created_at: z.string(),
});

export const githubIssueListSchema = z.array(githubIssueSchema);
export const githubPRListSchema = z.array(githubPRSchema);
export const githubCommentListSchema = z.array(githubCommentSchema);

export type GitHubUser = z.infer<typeof githubUserSchema>;
export type GitHubLabel = z.infer<typeof githubLabelSchema>;
export type GitHubIssue = z.infer<typeof githubIssueSchema>;
export type GitHubPR = z.infer<typeof githubPRSchema>;
export type GitHubComment = z.infer<typeof githubCommentSchema>;
