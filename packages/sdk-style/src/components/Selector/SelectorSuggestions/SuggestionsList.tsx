import classNames from 'classnames';

import SelectorTag from '../SelectorTag';

import type { SelectorValue } from '../Selector';

export type SuggestionsListProps = {
  selectors?: SelectorValue[];
  onSelect?: (selector: SelectorValue) => void;
};

const SuggestionsList = ({ selectors = [], onSelect }: SuggestionsListProps) => {
  return (
    <div className="flex flex-col">
      <div className="text-sm font-bold mb-1">Tokens Availables</div>
      <div
        className={classNames('flex flex-col overflow-y-auto items-start max-h-[250px] text-xs gap-1', {
          'pl-1': selectors.length > 0
        })}
      >
        {selectors.map((selector, index) => (
          <SelectorTag
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
          <div className="p-3 border-2 border-dashed border-gray-300 rounded-sm text-center">No tokens availables</div>
        )}
      </div>
    </div>
  );
};

export default SuggestionsList;
