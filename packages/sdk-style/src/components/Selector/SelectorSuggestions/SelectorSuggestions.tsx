import { useCallback, useMemo } from 'react';

import SuggestionsCreator from './SuggestionsCreator';
import SuggestionsList from './SuggestionsList';

import type { SelectorValue } from '../Selector';

export type SelectorSuggestionsProps = {
  selector?: string;
  onSelect?: (tag: SelectorValue) => void;
  onCreate?: (tag: SelectorValue) => void;
  selectors?: SelectorValue[];
};

const SelectorSuggestions = ({ onSelect, onCreate, selector = '', selectors = [] }: SelectorSuggestionsProps) => {
  const alreadyExists = useMemo(() => selector && selectors.find(s => s.name === selector), [selector, selectors]);

  const handleClick = useCallback((tag: SelectorValue) => onSelect?.(tag), [onSelect]);

  const handleClickCreate = useCallback((tag: SelectorValue) => onCreate?.(tag), [onCreate]);

  const finalSelectors = useMemo(() => {
    let finalSelectors = selectors;
    if (selector) {
      finalSelectors = finalSelectors.filter(token => token.name.toLowerCase().includes(selector.toLowerCase()));
    }

    return finalSelectors;
  }, [selectors, selector]);

  return (
    <div className="flex w-full flex-col gap-2 px-2 py-2">
      {selector && !alreadyExists && <SuggestionsCreator selector={selector} onClick={handleClickCreate} />}
      <SuggestionsList selectors={finalSelectors} onSelect={handleClick} />
    </div>
  );
};

export default SelectorSuggestions;
