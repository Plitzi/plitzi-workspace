import SelectorItem from '../SelectorItem';

import type { SelectorValue } from '../Selector';

export type SuggestionsListProps = {
  selectors?: SelectorValue[];
  onSelect?: (selector: SelectorValue) => void;
};

const SuggestionsList = ({ selectors = [], onSelect }: SuggestionsListProps) => {
  return (
    <div className="flex w-full flex-col">
      <div className="mb-1 w-full text-sm font-bold text-zinc-800 dark:text-zinc-200">Tokens Availables</div>
      <div className="flex max-h-[250px] flex-col items-start gap-1 overflow-y-auto text-xs">
        {selectors.map((selector, index) => (
          <SelectorItem
            className="cursor-pointer"
            key={`${selector.name}_${index}`}
            selector={selector.name}
            type={selector.type}
            editable={false}
            onClick={onSelect}
            active
          />
        ))}
        {selectors.length === 0 && (
          <div className="w-full rounded-sm border-2 border-dashed border-gray-300 p-3 text-center text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
            No tokens availables
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionsList;
