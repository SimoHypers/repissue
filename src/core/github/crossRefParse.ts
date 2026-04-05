/**
 * GitHub's documented closing keywords — all case-insensitive.
 * https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue
 */
const CLOSING_KEYWORDS = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved'];

// Matches: "closes #42", "Fixes #123", "RESOLVED #7" etc.
// Also matches "closes owner/repo#42" — we capture just the number.
const CROSS_REF_RE = new RegExp(
  `(?:${CLOSING_KEYWORDS.join('|')})\\s+(?:[\\w.-]+/[\\w.-]+)?#(\\d+)`,
  'gi',
);

// Also match bare references like "#42" or "references #42" that aren't closing keywords
const MENTION_RE = /#(\d+)/g;

export interface CrossRefs {
  /** Issue/PR numbers this item explicitly closes/fixes/resolves */
  closes: number[];
  /** Issue/PR numbers this item merely mentions */
  mentions: number[];
}

const extractNumbers = (re: RegExp, text: string): number[] => {
  const matches: number[] = [];
  let match: RegExpExecArray | null;
  // Reset lastIndex before use since regex is reused
  re.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(text)) !== null) {
    matches.push(parseInt(match[1], 10));
  }
  return matches;
};

export const parseCrossRefs = (body: string | null): CrossRefs => {
  if (!body) return { closes: [], mentions: [] };

  const closes = [...new Set(extractNumbers(new RegExp(CROSS_REF_RE.source, 'gi'), body))];

  // Mentions = all #N references minus those already in closes
  const closesSet = new Set(closes);
  const allMentions = [...new Set(extractNumbers(new RegExp(MENTION_RE.source, 'g'), body))];
  const mentions = allMentions.filter((n) => !closesSet.has(n));

  return { closes, mentions };
};

export interface AnnotatedCrossRefs {
  closes: number[];
  mentions: number[];
}

/**
 * Parse cross-references from both the body and all comment bodies of an item.
 * Returns a merged, deduplicated result.
 */
export const parseCrossRefsFromThread = (
  body: string | null,
  commentBodies: Array<string | null>,
): AnnotatedCrossRefs => {
  const allBodies = [body, ...commentBodies];
  const allCloses = new Set<number>();
  const allMentions = new Set<number>();

  for (const b of allBodies) {
    const refs = parseCrossRefs(b);
    refs.closes.forEach((n) => allCloses.add(n));
    refs.mentions.forEach((n) => allMentions.add(n));
  }

  // Mentions should not include numbers already in closes
  allCloses.forEach((n) => allMentions.delete(n));

  return {
    closes: [...allCloses].sort((a, b) => a - b),
    mentions: [...allMentions].sort((a, b) => a - b),
  };
};