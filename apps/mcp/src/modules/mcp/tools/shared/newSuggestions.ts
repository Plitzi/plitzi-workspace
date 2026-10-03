import { suggestSpace } from '@plitzi/sdk-authoring';

import type { Space } from '../../helpers';
import type { Suggestion } from '@plitzi/sdk-authoring';

const keyOf = ({ code, elementIds }: Suggestion): string => `${code}|${[...elementIds].sort().join(',')}`;

/**
 * The shorter ways to the same page a batch opened up — a header the agent just copied onto a third page, a button it
 * gave a text child — and none the space already had: those were said when they appeared, and saying them on every
 * batch would bury the new ones. Not problems: nothing here blocks anything.
 */
export const newSuggestions = (before: Space, after: Space): string[] => {
  const had = new Set(suggestSpace({ schema: before.schema, style: before.style }).map(keyOf));

  return suggestSpace({ schema: after.schema, style: after.style })
    .filter(suggestion => !had.has(keyOf(suggestion)))
    .map(
      ({ code, message, saves }) =>
        `[${code}] ${message}${saves > 0 ? ` (saves ${String(saves)} element${saves === 1 ? '' : 's'})` : ''}`
    );
};
