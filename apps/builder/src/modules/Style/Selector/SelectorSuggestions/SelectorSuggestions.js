// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Relatives
import SuggestionsCreator from './SuggestionsCreator';
import SuggestionsList from './SuggestionsList';

/**
 * @param {{
 *   onSelect?: (tag: string) => void;
 *   onCreate?: (tag: string) => void;
 *   selector?: string;
 *   selectors?: { name: string; type: string }[];
 * }} props
 * @returns {React.ReactElement}
 */
const SelectorSuggestions = props => {
  const { onSelect = noop, onCreate = noop, selector = '', selectors = [] } = props;
  const alreadyExists = useMemo(() => selector && selectors.find(s => s.name === selector), [selector, selectors]);

  const handleClick = useCallback(tag => onSelect(tag), [onSelect]);

  const handleClickCreate = useCallback(tag => onCreate(tag), [onCreate]);

  const finalSelectors = useMemo(() => {
    let finalSelectors = selectors;
    if (selectors && !selector) {
      finalSelectors = finalSelectors.filter(token => token.name?.toLowerCase().includes(selector.toLowerCase()));
    }

    return finalSelectors;
  }, [selectors, selector]);

  return (
    <div className="flex flex-col py-2 px-2 gap-2">
      {selector && !alreadyExists && <SuggestionsCreator selector={selector} onClick={handleClickCreate} />}
      <SuggestionsList selectors={finalSelectors} onSelect={handleClick} />
    </div>
  );
};

export default SelectorSuggestions;
