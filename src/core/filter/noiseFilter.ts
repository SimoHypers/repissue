import type { GitHubComment, GitHubIssue, GitHubPR } from '../github/githubTypes.js';
import type { RepissueConfigMerged } from '../../config/configSchema.js';

// Determines whether a comment body carries no information beyond a simple
// reaction (👍, +1, -1, etc.) and can therefore be dropped as noise.
//
// Strategy: strip out every recognised reaction token, then check if
// anything substantive remains.  We deliberately do NOT use a single
// character-class regex here because putting `+`, `-`, and `1` inside
// `[…]` would cause strings like "111" or "+++" — which are real content —
// to be silently filtered as noise.
//
// Tokens stripped:
//   • The literal strings "+1" and "-1" (vote shorthand)
//   • Unicode emoji in the Supplementary Multilingual Plane (U+1F000–U+1FFFF)
//   • Miscellaneous Symbols and Dingbats (U+2600–U+27FF)
//   • Variation selectors (U+FE00–U+FEFF) that modify preceding emoji
//   • Emoji skin-tone modifiers (U+1F3FB–U+1F3FF)
export const isReactionOnly = (body: string | null): boolean => {
  if (body === null || body.trim() === '') return true;

  const cleaned = body
    .replace(/\+1|-1/g, '')                         // +1 / -1 vote shorthand
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')         // emoji (supplementary plane)
    .replace(/[\u{2600}-\u{27FF}]/gu, '')           // misc symbols & dingbats
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')           // variation selectors
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')         // skin-tone modifiers
    .trim();

  return cleaned === '';
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