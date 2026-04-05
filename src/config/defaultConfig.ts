import type { RepissueConfigMerged } from './configSchema.js';

export const defaultConfig: RepissueConfigMerged = {
  output: {
    filePath: 'repissue-output.md',
    style: 'markdown',
    fileSummary: true,
    headerText: undefined,
  },
  github: {
    token: undefined,
    includeIssues: true,
    includePRs: true,
    includeMergedDays: undefined,
    includeClosedDays: undefined,
    labelPriority: ['bug', 'security', 'P0'],
    ignoreBots: true,
    knownBots: ['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]'],
    maxCommentsPerItem: 50,
  },
  security: {
    enableCheck: false,
  },
};
