import type { GitHubComment, GitHubIssue, GitHubPR } from '../github/githubTypes.js';
import type { AnnotatedCrossRefs } from '../github/crossRefParse.js';
import type { RepissueConfigMerged } from '../../config/configSchema.js';

export interface EnrichedIssue {
  issue: GitHubIssue;
  comments: GitHubComment[];
  /** Comments that were filtered out (bots / reaction-only) */
  filteredCommentCount: number;
  crossRefs: AnnotatedCrossRefs;
}

export interface EnrichedPR {
  pr: GitHubPR;
  comments: GitHubComment[];
  filteredCommentCount: number;
  crossRefs: AnnotatedCrossRefs;
}

export interface OutputContext {
  repo: string;
  generatedAt: string; // ISO 8601
  issues: EnrichedIssue[];
  prs: EnrichedPR[];
  config: RepissueConfigMerged;
}