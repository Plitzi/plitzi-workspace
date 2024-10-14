// Packages
import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import get from 'lodash/get.js';
import noop from 'lodash/noop.js';
import Input from '@plitzi/plitzi-ui-components/Input/index.js';

// Relatives
import ElementsListItem from './ElementsListItem.js';

/**
 * @param {{
 *   className?: string;
 *   elements?: object[];
 *   elementSelected?: string;
 *   onSelect?: (string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementsList = props => {
  const { elements, className, elementSelected, onSelect = noop } = props;
  const [filter, setFilter] = useState('');
  const elementsSorted = useMemo(
    () => elements.filter(element => element.definition.label.toLowerCase().includes(filter.toLowerCase())),
    [elements, filter]
  );

  const handleChangeFilter = useCallback(e => setFilter(e.target.value), []);

  return (
    <div className={classNames('flex flex-col h-full border-r border-gray-300 gap-4', className)}>
      <Input inputClassName="rounded" value={filter} onChange={handleChangeFilter} placeholder="Search..." size="sm" />
      <div className="flex flex-col overflow-y-auto gap-1 text-xs">
        {elementsSorted.map((element, i) => (
          <ElementsListItem
            key={i}
            name={element.definition.label}
            isSelected={elementSelected === element.id}
            isVisible={get(element, 'definition.initialState.visibility', true)}
            id={element.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default ElementsList;
