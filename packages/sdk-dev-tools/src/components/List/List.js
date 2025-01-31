// Packages
import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop.js';
import Input from '@plitzi/plitzi-ui-components/Input/index.js';

// Relatives
import ListItem from './ListItem.js';

/**
 * @param {{
 *   className?: string;
 *   items?: object[];
 *   value?: string;
 *   onSelect?: (string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const List = props => {
  const { items, className, value, onSelect = noop } = props;
  const [filter, setFilter] = useState('');
  const itemsSorted = useMemo(
    () => items.filter(item => (item?.name ?? '').toLowerCase().includes(filter.toLowerCase())),
    [items, filter]
  );

  const handleChangeFilter = useCallback(e => setFilter(e.target.value), []);

  const handleSelect = useCallback(id => onSelect(items.find(item => item.id === id)), [items, onSelect]);

  return (
    <div className={classNames('flex flex-col h-full border-r border-gray-300 gap-4', className)}>
      <Input
        inputClassName="rounded-sm"
        value={filter}
        onChange={handleChangeFilter}
        placeholder="Search..."
        size="sm"
      />
      <div className="flex flex-col overflow-y-auto gap-1 text-sm">
        {itemsSorted.map((item, i) => (
          <ListItem
            key={i}
            label={item.label}
            name={item.name}
            isSelected={value?.id === item.id}
            id={item.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default List;
