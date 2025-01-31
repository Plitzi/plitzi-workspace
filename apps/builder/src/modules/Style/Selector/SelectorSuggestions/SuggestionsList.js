// Packages
import classNames from 'classnames';
import noop from 'lodash/noop';

// Relatives
import SelectorTag from '../SelectorTag';

/**
 * @param {{
 *   selectors?: { name: string; type: string }[];
 *   onSelect?: (selector: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SuggestionsList = props => {
  const { selectors = [], onSelect = noop } = props;

  return (
    <div className="flex flex-col">
      <div className="text-sm font-bold mb-1">Tokens Availables</div>
      <div
        className={classNames('flex flex-col overflow-y-auto items-start max-h-[250px] text-xs gap-1', {
          'pl-1': selectors && selectors.length > 0
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
        {(!selectors || selectors.length === 0) && (
          <div className="p-3 border-2 border-dashed border-gray-300 rounded-sm text-center">No tokens availables</div>
        )}
      </div>
    </div>
  );
};

export default SuggestionsList;
