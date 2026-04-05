import { z } from 'zod';

export const outputConfigSchema = z.object({
  filePath: z.string().default('repissue-output.md'),
  style: z.enum(['markdown', 'plain', 'xml']).default('markdown'),
  fileSummary: z.boolean().default(true),
  headerText: z.string().optional(),
});

export const githubConfigSchema = z.object({
  token: z.string().optional(),
  includeIssues: z.boolean().default(true),
  includePRs: z.boolean().default(true),
  includeMergedDays: z.number().int().positive().optional(),
  includeClosedDays: z.number().int().positive().optional(),
  labelPriority: z.array(z.string()).default(['bug', 'security', 'P0']),
  ignoreBots: z.boolean().default(true),
  knownBots: z
    .array(z.string())
    .default(['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]']),
  maxCommentsPerItem: z.number().int().positive().default(50),
});

export const securityConfigSchema = z.object({
  enableCheck: z.boolean().default(false),
});

// Shape accepted in repissue.config.json — all fields optional (defaults fill gaps)
export const repissueConfigFileSchema = z.object({
  output: outputConfigSchema.partial().default({}),
  github: githubConfigSchema.partial().default({}),
  security: securityConfigSchema.partial().default({}),
});

// Fully resolved config after file + CLI merge — every field has a value
export const repissueConfigMergedSchema = z.object({
  output: outputConfigSchema,
  github: githubConfigSchema,
  security: securityConfigSchema,
});

export type OutputConfig = z.infer<typeof outputConfigSchema>;
export type GithubConfig = z.infer<typeof githubConfigSchema>;
export type SecurityConfig = z.infer<typeof securityConfigSchema>;
export type RepissueConfigFile = z.infer<typeof repissueConfigFileSchema>;
export type RepissueConfigMerged = z.infer<typeof repissueConfigMergedSchema>;
