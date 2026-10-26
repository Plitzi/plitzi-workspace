/**
 * Texts told apart by their words: what two agents said of one thing in their own words, and what explain was asked
 * about one topic in several ways (`dialogContainer`, `openDialog`, "modal dialog").
 */

/** Words too common in a run's texts to say what one is about. */
const COMMON = new Set([
  'about',
  'action',
  'actions',
  'after',
  'agent',
  'also',
  'because',
  'before',
  'cannot',
  'container',
  'could',
  'does',
  'element',
  'elements',
  'every',
  'from',
  'have',
  'into',
  'json',
  'list',
  'none',
  'only',
  'page',
  'pages',
  'plitzi',
  'said',
  'says',
  'search',
  'should',
  'task',
  'that',
  'their',
  'them',
  'then',
  'there',
  'this',
  'what',
  'when',
  'which',
  'with',
  'would'
]);

/**
 * The words a text is about: its names split (`openDialog` → open, dialog), lower case, the common ones left out — and
 * its flags whole (`--as`, `--follow`): short, and what tells one complaint of a command from another.
 */
export const wordsOf = (said: string): Set<string> =>
  new Set([
    ...(said.match(/--[a-z][\w-]*/g) ?? []),
    ...said
      .replace(/--[a-z][\w-]*/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(word => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word))
      .filter(word => word.length >= 4 && !COMMON.has(word))
  ]);

/** How alike two sets of words are: what they share of all they hold. */
const likeness = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  const all = new Set([...a, ...b]).size;

  return all === 0 ? 0 : shared(a, b) / all;
};

const shared = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => [...a].filter(word => b.has(word)).length;

/** Texts this alike are one thing said twice. */
const ALIKE = 0.28;

/**
 * One thing said twice: alike as a whole, or a short text whose words are half in the other's — two of them at least
 * (three agents said "page play has no --as" in three lengths).
 */
const isAlike = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  likeness(a, b) >= ALIKE || (shared(a, b) >= 2 && shared(a, b) / Math.min(a.size, b.size) >= 0.5);

/**
 * The texts, grouped by what they are about: each group in the order its texts came. A text joins the group whose
 * first text it is alike — never the group's words gathered so far: a long notice of two things drew both into one
 * (a run grouped "page measure measures the first row only" under an undici crash).
 */
export const groupAlike = <T>(items: readonly T[], said: (item: T) => string): T[][] => {
  const groups: { words: Set<string>; items: T[] }[] = [];
  for (const item of items) {
    const words = wordsOf(said(item));
    const group = groups.find(each => isAlike(words, each.words));
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ words, items: [item] });
    }
  }

  return groups.map(group => group.items);
};

/** Whether two texts say one thing: what a finding of this run and one of a run before are told apart by. */
export const saysAlike = (a: string, b: string): boolean => isAlike(wordsOf(a), wordsOf(b));
