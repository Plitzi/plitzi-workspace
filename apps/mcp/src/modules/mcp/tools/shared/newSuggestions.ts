import { suggestSpace } from '@plitzi/sdk-authoring';

import type { Space } from '../../helpers';
import type { Suggestion } from '@plitzi/sdk-authoring';

/**
 * What a suggestion is about, one key each: its elements together, or — for one about declarations, which names many
 * at once — each class, token or component on its own, so the one a batch just left unused is new beside the ones the
 * space already had.
 */
const keysOf = ({ code, elementIds, subjects }: Suggestion): string[] =>
  subjects?.length ? subjects.map(subject => `${code}|${subject}`) : [`${code}|${[...elementIds].sort().join(',')}`];

/**
 * The shorter ways to the same page a batch opened up — a header the agent just copied onto a third page, a button it
 * gave a text child, a class it left nothing wearing — and none the space already had: those were said when they
 * appeared, and saying them on every batch would bury the new ones. Not problems: nothing here blocks anything.
 */
export const newSuggestions = (before: Space, after: Space): string[] => {
  const had = new Set(suggestSpace({ schema: before.schema, style: before.style }).flatMap(keysOf));

  return suggestSpace({ schema: after.schema, style: after.style })
    .filter(suggestion => keysOf(suggestion).some(key => !had.has(key)))
    .map(
      ({ code, message, saves }) =>
        `[${code}] ${message}${saves > 0 ? ` (saves ${String(saves)} element${saves === 1 ? '' : 's'})` : ''}`
    );
};
