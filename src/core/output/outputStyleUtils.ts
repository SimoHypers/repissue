import Handlebars from 'handlebars';

let registered = false;

// Maps label name patterns to an emoji prefix.
// Checked in order — first match wins. Case-insensitive substring match.
const LABEL_EMOJI_MAP: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /\bsecurity\b/i,                     emoji: '🔒' },
  { pattern: /\bbug\b/i,                           emoji: '⚠️' },
  { pattern: /\bcrash\b/i,                         emoji: '💥' },
  { pattern: /\bperformance\b|\bperf\b/i,          emoji: '⚡' },
  { pattern: /\bbreaking[- ]?change\b/i,           emoji: '🚨' },
  { pattern: /\bregression\b/i,                    emoji: '📉' },
  { pattern: /\benhancement\b|\bfeature\b/i,       emoji: '✨' },
  { pattern: /\bgood[- ]first[- ]issue\b/i,        emoji: '🌱' },
  { pattern: /\bhelp[- ]wanted\b/i,                emoji: '🙋' },
  { pattern: /\bquestion\b/i,                      emoji: '❓' },
  { pattern: /\bdocument(ation)?\b|\bdocs?\b/i,    emoji: '📖' },
  { pattern: /\btest(s|ing)?\b/i,                  emoji: '🧪' },
  { pattern: /\bduplicate\b|\bdup\b/i,             emoji: '♻️' },
  { pattern: /\bwontfix\b|\bwont[- ]fix\b/i,       emoji: '🚫' },
  { pattern: /\binvalid\b/i,                       emoji: '❌' },
  { pattern: /\bdependenc(y|ies)\b|\bdeps?\b/i,    emoji: '📦' },
  { pattern: /\brefactor\b/i,                      emoji: '🔧' },
  { pattern: /\bci\b|\bcd\b|\bpipeline\b/i,        emoji: '⚙️' },
  { pattern: /\btypo\b/i,                          emoji: '✏️' },
  { pattern: /\bP0\b/,                             emoji: '🔴' },
  { pattern: /\bP1\b/,                             emoji: '🟠' },
  { pattern: /\bP2\b/,                             emoji: '🟡' },
];

const getLabelEmoji = (name: string): string => {
  for (const { pattern, emoji } of LABEL_EMOJI_MAP) {
    if (pattern.test(name)) return emoji;
  }
  return '🏷️';
};

export const registerHelpers = (): void => {
  if (registered) return;
  registered = true;

  // Format ISO date string as YYYY-MM-DD
  Handlebars.registerHelper('formatDate', (isoString: string) => {
    if (!isoString) return '';
    return isoString.slice(0, 10);
  });

  // Truncate a string to maxLen characters, appending "…" if cut
  Handlebars.registerHelper('truncate', (str: string | null | undefined, maxLen: number) => {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return `${str.slice(0, maxLen)}…`;
  });

  // Return user login or "[unknown]" for null users
  Handlebars.registerHelper('userLogin', (user: { login: string } | null | undefined) => {
    return user?.login ?? '[unknown]';
  });

  // Render label names as emoji+backtick badges: ⚠️ `bug`  🔒 `security`
  Handlebars.registerHelper('labelBadges', (labels: Array<{ name: string }> | undefined) => {
    if (!labels || labels.length === 0) return '';
    return labels.map((l) => `${getLabelEmoji(l.name)} \`${l.name}\``).join('  ') + '  ';
  });

  // Render label names as comma-separated list for plain text (with emojis)
  Handlebars.registerHelper('labelNames', (labels: Array<{ name: string }> | undefined) => {
    if (!labels || labels.length === 0) return 'none';
    return labels.map((l) => `${getLabelEmoji(l.name)} ${l.name}`).join(', ');
  });

  // Join an array of numbers as "#42, #318"
  Handlebars.registerHelper('joinNumbers', (nums: number[]) => {
    if (!nums || nums.length === 0) return '';
    return nums.map((n) => `#${n}`).join(', ');
  });

  // Escape special XML characters
  Handlebars.registerHelper('xmlEscape', (str: string | null | undefined) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  });

  // Strip markdown image syntax and raw <img> tags from text.
  // Images are noise in a text context file — they add nothing for AI agents
  // and clutter the output for human readers. Replaces with a short note.
  Handlebars.registerHelper('stripImages', (str: string | null | undefined) => {
    if (!str) return '';
    return str
      // Remove markdown images: ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt) => {
        const label = alt?.trim();
        return label ? `*[image: ${label}]*` : '*[image]*';
      })
      // Remove raw HTML img tags
      .replace(/<img[^>]*>/gi, '*[image]*')
      // Clean up multiple blank lines that images leave behind
      .replace(/(\n\s*){3,}/g, '\n\n')
      .trim();
  });
};