import SelectorItem from '../SelectorItem';

import type { SelectorValue } from '../Selector';

export type SuggestionsListProps = {
  selectors?: SelectorValue[];
  onSelect?: (selector: SelectorValue) => void;
};

const SuggestionsList = ({ selectors = [], onSelect }: SuggestionsListProps) => {
  return (
    <div className="flex flex-col w-full">
      <div className="text-sm font-bold mb-1 w-full">Tokens Availables</div>
      <div className="flex flex-col overflow-y-auto items-start max-h-[250px] text-xs gap-1">
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
          <div className="p-3 border-2 border-dashed border-gray-300 rounded-sm text-center w-full">
            No tokens availables
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionsList;
