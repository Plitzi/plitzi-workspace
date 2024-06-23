// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';
import isEmpty from 'lodash/isEmpty';
import classNames from 'classnames';

// Relatives
import SelectorTag from './SelectorTag';

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
    if (selectors && !isEmpty(selector)) {
      finalSelectors = finalSelectors.filter(token => token.name?.toLowerCase().includes(selector.toLowerCase()));
    }

    return finalSelectors;
  }, [selectors, selector]);

  return (
    <div className="flex flex-col py-2 px-2 gap-2">
      {selector && !alreadyExists && (
        <div className="flex flex-col">
          <div className="text-sm font-bold">New Token</div>
          <div className="flex items-center gap-1 text-xs px-2">
            <div>Create:</div>
            <SelectorTag selector={selector} editable={false} active onClick={handleClickCreate} />
          </div>
        </div>
      )}
      <div className="flex flex-col">
        <div className="text-sm font-bold mb-1">Tokens Availables</div>
        <div
          className={classNames('flex flex-col overflow-y-auto items-start max-h-[250px] text-xs gap-1', {
            'pl-1': finalSelectors && finalSelectors.length > 0
          })}
        >
          {finalSelectors.map((selector, index) => (
            <SelectorTag
              className="cursor-pointer"
              key={`${selector.name}_${index}`}
              selector={selector.name}
              type={selector.type}
              editable={false}
              onClick={handleClick}
              active
            />
          ))}
          {(!finalSelectors || finalSelectors.length === 0) && (
            <div className="p-3 border-2 border-dashed border-gray-300 rounded text-center">No tokens availables</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectorSuggestions;
