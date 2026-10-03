import clsx from 'clsx';

import { MUTED } from '../../helpers';
import SuggestionItem from '../SuggestionItem';

import type { TSpaceSuggestion } from '@plitzi/sdk-shared';

export type SuggestionGroupProps = {
  suggestions: TSpaceSuggestion[];
  onDismiss: () => void;
};

/** The shorter ways to the same page, the ones that save the most elements first. Nothing in it blocks a publish. */
const SuggestionGroup = ({ suggestions, onDismiss }: SuggestionGroupProps) => {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-1">
      <h5 className={clsx('text-[10px] font-bold tracking-wider uppercase', MUTED)}>
        Suggestions · {suggestions.length}
      </h5>
      <p className={clsx('text-[11px] leading-relaxed', MUTED)}>
        The same page with fewer elements. Nothing here is wrong — take one unless the copies are about to diverge.
      </p>
      <ul className="flex flex-col">
        {suggestions.map(suggestion => (
          <SuggestionItem
            key={`${suggestion.code}:${suggestion.elementIds.join(',')}`}
            suggestion={suggestion}
            onDismiss={onDismiss}
          />
        ))}
      </ul>
    </section>
  );
};

export default SuggestionGroup;
