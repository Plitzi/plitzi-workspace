import { byCode, SUGGESTION_TEXT } from '../../helpers';
import CodeGroup from '../CodeGroup';
import SuggestionItem from '../SuggestionItem';

import type { TSpaceSuggestion } from '@plitzi/sdk-shared/network';

export type SuggestionGroupProps = {
  suggestions: TSpaceSuggestion[];
  onDismiss: () => void;
};

const savedBy = (suggestions: readonly TSpaceSuggestion[]): number =>
  suggestions.reduce((sum, suggestion) => sum + suggestion.saves, 0);

/**
 * The shorter, lighter or phone-ready ways to the same page, a group per code, the ones that save the most first.
 * Nothing in it blocks a publish.
 */
const SuggestionGroup = ({ suggestions, onDismiss }: SuggestionGroupProps) => {
  const groups = byCode(suggestions).sort((a, b) => savedBy(b.items) - savedBy(a.items));

  return (
    <ul className="flex flex-col gap-2">
      {groups.map(group => {
        const saves = savedBy(group.items);

        return (
          <CodeGroup
            key={group.code}
            code={group.code}
            count={group.items.length}
            fix={group.fix}
            fixLabel="The short way"
            aside={saves > 0 ? `saves ${String(saves)}` : undefined}
            icon="fa-lightbulb"
            tone={SUGGESTION_TEXT}
            defaultOpen={groups.length === 1}
          >
            {group.items.map(suggestion => (
              <SuggestionItem
                key={suggestion.elementIds.join(',') || suggestion.message}
                suggestion={suggestion}
                onDismiss={onDismiss}
              />
            ))}
          </CodeGroup>
        );
      })}
    </ul>
  );
};

export default SuggestionGroup;
