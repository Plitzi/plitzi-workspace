// Packages
import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import Input from '@plitzi/plitzi-ui-components/Input';

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
  const { elements, className, elementSelected, onSelect } = props;
  const [filter, setFilter] = useState('');
  const elementsSorted = useMemo(
    () => elements.filter(element => element.definition.label.toLowerCase().includes(filter.toLowerCase())),
    [elements, filter]
  );

  const handleChangeFilter = useCallback(e => setFilter(e.target.value), []);

  const handleClickElement = useCallback(elementId => () => onSelect(elementId), []);

  return (
    <div className={classNames('flex flex-col h-full border-r border-gray-300 gap-4', className)}>
      <Input inputClassName="rounded" value={filter} onChange={handleChangeFilter} placeholder="Search..." size="sm" />
      <div className="flex flex-col overflow-y-auto gap-1 text-xs">
        {elementsSorted.map((element, i) => {
          return (
            <div
              key={i}
              className={classNames('cursor-pointer border border-gray-300 rounded px-2 py-1', {
                'bg-purple-300': elementSelected === element.id,
                'hover:bg-purple-200': elementSelected !== element.id
              })}
              onClick={handleClickElement(element.id)}
            >
              {element.definition.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ElementsList;
