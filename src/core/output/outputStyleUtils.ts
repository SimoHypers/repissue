import Handlebars from 'handlebars';

let registered = false;

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

  // Render label names as [bug][P0] badges
  Handlebars.registerHelper('labelBadges', (labels: Array<{ name: string }> | undefined) => {
    if (!labels || labels.length === 0) return '';
    return labels.map((l) => `[${l.name}]`).join('') + ' ';
  });

  // Render label names as comma-separated list for plain text
  Handlebars.registerHelper('labelNames', (labels: Array<{ name: string }> | undefined) => {
    if (!labels || labels.length === 0) return 'no labels';
    return labels.map((l) => l.name).join(', ');
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
};