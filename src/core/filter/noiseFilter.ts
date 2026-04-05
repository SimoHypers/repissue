import type { GitHubComment, GitHubIssue, GitHubPR } from '../github/githubTypes.js';
import type { RepissueConfigMerged } from '../../config/configSchema.js';

// Matches comment bodies that are purely emoji reactions or +1/-1 votes —
// these add no signal for an AI agent consuming the output.
// Covers: +1, -1, 👍, 👎, ❤️, 🎉, 🚀, 👀, 😕, 🎊 and whitespace combinations.
const REACTION_ONLY_RE = /^[\s\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}+\-1👍👎❤🎉🚀👀😕🎊]*$/u;

export const isReactionOnly = (body: string | null): boolean => {
  if (body === null || body.trim() === '') return true;
  return REACTION_ONLY_RE.test(body.trim());
};

export const isBotUser = (login: string | null | undefined, knownBots: string[]): boolean => {
  if (!login) return false;
  // GitHub bot accounts always end with [bot] — catch any bot even if not in knownBots list
  if (login.endsWith('[bot]')) return true;
  return knownBots.includes(login);
};

export const filterComments = (
  comments: GitHubComment[],
  config: RepissueConfigMerged,
): GitHubComment[] => {
  const { ignoreBots, knownBots, maxCommentsPerItem } = config.github;

  return comments
    .filter((c) => {
      if (isReactionOnly(c.body)) return false;
      if (ignoreBots && isBotUser(c.user?.login, knownBots)) return false;
      return true;
    })
    .slice(0, maxCommentsPerItem);
};

export const filterIssues = (
  issues: GitHubIssue[],
  config: RepissueConfigMerged,
): GitHubIssue[] => {
  const { ignoreBots, knownBots } = config.github;

  return issues.filter((issue) => {
    // Filter out issues authored by bots
    if (ignoreBots && isBotUser(issue.user?.login, knownBots)) return false;
    return true;
  });
};

export const filterPRs = (
  prs: GitHubPR[],
  config: RepissueConfigMerged,
): GitHubPR[] => {
  const { ignoreBots, knownBots } = config.github;

  return prs.filter((pr) => {
    if (ignoreBots && isBotUser(pr.user?.login, knownBots)) return false;
    return true;
  });
};