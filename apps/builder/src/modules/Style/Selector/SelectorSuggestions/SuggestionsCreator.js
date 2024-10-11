// Packages
import noop from 'lodash/noop';

// Relatives
import SelectorTag from '../SelectorTag';

/**
 * @param {{
 *   selector?: string;
 *   onClick?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SuggestionsCreator = props => {
  const { selector, onClick = noop } = props;

  return (
    <div className="flex flex-col">
      <div className="text-sm font-bold">New Token</div>
      <div className="flex items-center gap-1 text-xs px-2">
        <div>Create:</div>
        <SelectorTag selector={selector} editable={false} active onClick={onClick} />
      </div>
    </div>
  );
};
export default SuggestionsCreator;
