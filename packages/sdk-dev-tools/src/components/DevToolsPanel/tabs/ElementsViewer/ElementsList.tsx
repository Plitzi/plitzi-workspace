import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useMemo, useState } from 'react';

import ElementsListItem from './ElementsListItem';

import type { Element } from '@plitzi/sdk-shared';

/**
 * How many rows this list will put in the DOM at once.
 *
 * A space is thousands of elements — the analytics screen alone is a few hundred — and every row here is a component
 * with a click handler and a visibility icon. Rendering all of them made opening this tab on a dense page a freeze,
 * and nobody was ever going to scroll past the first screenful anyway: the filter above is how you reach the rest,
 * and the count below says how many it is hiding.
 */
const MAX_ROWS = 200;

export type ElementsListProps = {
  elements?: Element[];
  elementSelected?: string;
  onSelect?: (id?: string) => void;
};

const ElementsList = ({ elements, elementSelected, onSelect }: ElementsListProps) => {
  const [filter, setFilter] = useState('');

  const elementsFiltered = useMemo(
    () => (elements ?? []).filter(element => element.definition.label.toLowerCase().includes(filter.toLowerCase())),
    [elements, filter]
  );
  const elementsShown = useMemo(() => elementsFiltered.slice(0, MAX_ROWS), [elementsFiltered]);
  const hidden = elementsFiltered.length - elementsShown.length;

  const handleChangeFilter = useCallback((filterValue: string) => setFilter(filterValue), []);

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col gap-2 border-r border-zinc-200 dark:border-zinc-700">
      <div className="px-2 pt-2">
        <Input value={filter} onChange={handleChangeFilter} placeholder="Search elements..." size="sm" />
      </div>
      <div className="flex flex-col overflow-y-auto text-xs text-zinc-700 dark:text-zinc-300">
        {elementsShown.length === 0 && (
          <div className="p-4 text-center text-zinc-400 dark:text-zinc-600">No elements</div>
        )}
        {elementsShown.map(element => (
          <ElementsListItem
            key={element.id}
            name={element.definition.label}
            isSelected={elementSelected === element.id}
            isVisible={get(element, 'definition.initialState.visibility', true)}
            id={element.id}
            onSelect={onSelect}
          />
        ))}
        {hidden > 0 && (
          <div className="p-3 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
            {hidden} more — narrow the search to reach them
          </div>
        )}
      </div>
    </div>
  );
};

export default ElementsList;
