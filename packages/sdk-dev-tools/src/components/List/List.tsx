import Input from '@plitzi/plitzi-ui/Input';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import ListItem from './ListItem';

import type { ReactNode } from 'react';

export type ListItem<T = Record<string, unknown>> = { id: string; name?: string; label: ReactNode } & Omit<
  T,
  'id' | 'name' | 'label'
>;

export type ListProps<T> = {
  className?: string;
  items?: T[];
  value?: string | T;
  onSelect?: (value?: T) => void;
};

const List = <T extends ListItem>({ items = [], className, value, onSelect }: ListProps<T>) => {
  const [filter, setFilter] = useState('');

  const itemsSorted = useMemo<ListItem[]>(
    () => items.filter(item => (item.name ?? '').toLowerCase().includes(filter.toLowerCase())),
    [items, filter]
  );

  const parsedValue = useMemo(
    () => (typeof value === 'string' ? items.find(item => item.id === value) : value),
    [value, items]
  );

  const handleChangeFilter = useCallback((filterValue: string) => setFilter(filterValue), []);
  const handleSelect = useCallback((id?: string) => onSelect?.(items.find(item => item.id === id)), [items, onSelect]);

  return (
    <div className={clsx('border-ui-line flex h-full flex-col gap-2 border-r', className)}>
      <div className="px-2 pt-2">
        <Input value={filter} onChange={handleChangeFilter} placeholder="Search..." size="sm" />
      </div>
      <div className="text-ui-fg flex flex-col overflow-y-auto text-xs">
        {!itemsSorted.length && <div className="text-ui-fg-subtle p-4 text-center">No items</div>}
        {itemsSorted.length > 0 &&
          itemsSorted.map((item, i) => (
            <ListItem
              key={i}
              label={item.label}
              name={item.name}
              isSelected={parsedValue?.id === item.id}
              id={item.id}
              onSelect={handleSelect}
            />
          ))}
      </div>
    </div>
  );
};

export default List;
