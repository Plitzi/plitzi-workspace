import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import ElementsListItem from './ElementsListItem';
import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

import type { Element } from '@plitzi/sdk-shared';

export type ElementsListProps = {
  elements?: Element[];
  elementSelected?: string;
  onSelect?: (id?: string) => void;
};

const ElementsList = ({ elements, elementSelected, onSelect }: ElementsListProps) => {
  const { isDark } = useDevToolsTheme();
  const [filter, setFilter] = useState('');

  const elementsSorted = useMemo(
    () => (elements ?? []).filter(element => element.definition.label.toLowerCase().includes(filter.toLowerCase())),
    [elements, filter]
  );

  const handleChangeFilter = useCallback((filterValue: string) => setFilter(filterValue), []);

  return (
    <div
      className={clsx(
        'flex h-full w-[280px] shrink-0 flex-col gap-2 border-r',
        isDark ? 'border-zinc-700' : 'border-zinc-200'
      )}
    >
      <div className="px-2 pt-2">
        <Input value={filter} onChange={handleChangeFilter} placeholder="Search elements..." size="sm" />
      </div>
      <div className={clsx('flex flex-col overflow-y-auto text-xs', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
        {elementsSorted.length === 0 ? (
          <div className={clsx('p-4 text-center', isDark ? 'text-zinc-600' : 'text-zinc-400')}>No elements</div>
        ) : (
          elementsSorted.map((element, i) => (
            <ElementsListItem
              key={i}
              name={element.definition.label}
              isSelected={elementSelected === element.id}
              isVisible={get(element, 'definition.initialState.visibility', true)}
              id={element.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ElementsList;
