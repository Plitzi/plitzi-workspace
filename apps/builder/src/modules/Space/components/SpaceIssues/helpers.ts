export type IssueSeverity = 'error' | 'warning';

/** The three lists the linter answers with, in the order they matter: what stops a publish first. */
export type IssueKind = 'errors' | 'warnings' | 'suggestions';

export const SEVERITY_TEXT: Record<IssueSeverity, string> = {
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-yellow-600 dark:text-yellow-400'
};

export const SEVERITY_ICON: Record<IssueSeverity, string> = {
  error: 'fa-circle-xmark',
  warning: 'fa-triangle-exclamation'
};

export const MUTED = 'text-ui-fg-subtle';

/** A suggestion is no problem at all: it reads in the accent, beside the red and the amber of what is wrong. */
export const SUGGESTION_TEXT = 'text-indigo-600 dark:text-indigo-400';

/** Every other part of a text split on backticks is code: `a \`b\` c` is text, code, text. */
export const partsOf = (text: string): { text: string; code: boolean }[] =>
  text.split('`').map((part, index) => ({ text: part, code: index % 2 === 1 }));

/** A code as a title: `repeated-shape` and `STYLE_WITHOUT_TAG` read "Repeated shape" and "Style without tag". */
export const titleOfCode = (code: string): string => {
  const words = code.toLowerCase().split(/[-_]+/).filter(Boolean).join(' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
};

export type CodeGroup<T> = { code: string; fix: string | null; items: T[] };

/**
 * The entries of one list by their code, in the order each code is first met: the linter lists the ones that matter
 * most first, so the groups keep that order. What to do is the code's row, so a group says it once.
 */
export const byCode = <T extends { code: string; fix: string | null }>(entries: readonly T[]): CodeGroup<T>[] => {
  const groups = new Map<string, CodeGroup<T>>();
  for (const entry of entries) {
    const group = groups.get(entry.code) ?? { code: entry.code, fix: entry.fix, items: [] };
    group.items.push(entry);
    groups.set(entry.code, group);
  }

  return [...groups.values()];
};
