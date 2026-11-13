import type { SelectorValue } from '../Selector';

/** What the list offers for what is typed: a class to create — none when one of that name is offered — and the rest. */
export type Suggestions = { creates?: string; list: SelectorValue[] };

/** The classes an element can take for what is typed, the new one first: what the list shows and the keys move through. */
export const suggestionsFor = (typed: string, available: readonly SelectorValue[]): Suggestions => {
  const query = typed.trim().toLowerCase();
  const list = query
    ? available.filter(selector => selector.type === 'class' && selector.name.toLowerCase().includes(query))
    : [...available];
  const exists = available.some(selector => selector.name === typed.trim());

  return { creates: query && !exists ? typed.trim() : undefined, list };
};
