import Input from '@plitzi/plitzi-ui/Input';
import get from 'lodash/get.js';
import { useCallback, useMemo, useState } from 'react';

import ElementsListItem from './ElementsListItem';

import type { Element } from '@plitzi/sdk-shared';

export type ElementsListProps = {
  elements?: Element[];
  elementSelected?: string;
  onSelect?: (id?: string) => void;
};

const ElementsList = ({ elements, elementSelected, onSelect }: ElementsListProps) => {
  const [filter, setFilter] = useState('');
  const elementsSorted = useMemo(
    () => (elements ?? []).filter(element => element.definition.label.toLowerCase().includes(filter.toLowerCase())),
    [elements, filter]
  );

  const handleChangeFilter = useCallback((filterValue: string) => setFilter(filterValue), []);

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 border-r border-gray-300 p-2">
      <Input value={filter} onChange={handleChangeFilter} placeholder="Search..." size="sm" />
      <div className="flex flex-col gap-1 overflow-y-auto text-xs">
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
