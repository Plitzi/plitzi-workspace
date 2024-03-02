// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import isEmpty from 'lodash/isEmpty';

// Relatives
import SelectorTag from './SelectorTag';

const SelectorSuggestions = props => {
  const { onSelect = noop, onCreate = noop, selector = '', selectors = [] } = props;

  const alreadyExists = useMemo(() => selector && selectors.find(s => s.name === selector), [selector, selectors]);

  const handleClick = useCallback((value, type) => onSelect(value, type), [onSelect]);

  const handleClickCreate = useCallback(() => onCreate(selector), [onCreate, selector]);

  const finalSelectors = useMemo(() => {
    let finalSelectors = selectors;
    if (selectors && !isEmpty(selector)) {
      finalSelectors = finalSelectors.filter(token => token.name?.toLowerCase().includes(selector.toLowerCase()));
    }

    return finalSelectors;
  }, [selectors, selector]);

  return (
    <div className="flex flex-col py-2 px-2">
      {selector && !alreadyExists && (
        <div className="flex flex-col">
          <div className="text-sm font-bold">New Token</div>
          <div className="flex items-center gap-1 text-xs px-2" onClick={handleClickCreate}>
            <div>Create:</div>
            <SelectorTag selector={selector} editable={false} />
          </div>
        </div>
      )}
      <div className="flex flex-col">
        <div className="text-sm font-bold mb-1">Tokens Availables</div>
        <div className="flex flex-col overflow-y-auto items-start max-h-[250px] text-xs gap-1 pl-1">
          {finalSelectors.map((selector, index) => (
            <SelectorTag
              key={index}
              selector={selector.name}
              type={selector.type}
              editable={false}
              onClick={handleClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

SelectorSuggestions.propTypes = {
  selector: PropTypes.string,
  selectors: PropTypes.array,
  onCreate: PropTypes.func,
  onSelect: PropTypes.func
};

export default SelectorSuggestions;
