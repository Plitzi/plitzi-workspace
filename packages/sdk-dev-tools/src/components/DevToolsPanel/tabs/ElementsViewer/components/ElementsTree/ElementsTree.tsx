import Input from '@plitzi/plitzi-ui/Input';
import { useMemo } from 'react';

import { filterRows } from '../../helpers/renderTree';
import TreeSection from '../TreeSection';

import type { TreeSection as Section } from '../../helpers/renderTree';

/**
 * How many rows a tree puts in the DOM at once. A page is hundreds of elements, every row a component with handlers:
 * rendering them all made opening the tab on a dense page a freeze, and the search is how the rest are reached.
 */
const MAX_ROWS = 200;

export type ElementsTreeProps = {
  sections: Section[];
  filter: string;
  selected?: string;
  onFilter: (filter: string) => void;
  onSelect: (id: string) => void;
  onHover: (id?: string) => void;
};

/** Every tree on screen, searched together: a match is kept with what holds it. */
const ElementsTree = ({ sections, filter, selected, onFilter, onSelect, onHover }: ElementsTreeProps) => {
  const shown = useMemo(
    () =>
      sections
        .map(section => ({ section, rows: filterRows(section.rows, filter) }))
        .filter(({ rows }) => rows.length > 0),
    [sections, filter]
  );

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col gap-2 border-r border-zinc-200 dark:border-zinc-700">
      <div className="px-2 pt-2">
        <Input value={filter} onChange={onFilter} placeholder="Search by name, id or type..." size="sm" />
      </div>
      <div className="flex flex-col overflow-y-auto text-xs">
        {shown.length === 0 && <div className="p-4 text-center text-zinc-400 dark:text-zinc-600">No elements</div>}
        {shown.map(({ section, rows }) => (
          <TreeSection
            key={`${section.kind}-${section.id}`}
            section={section}
            rows={rows.slice(0, MAX_ROWS)}
            more={Math.max(rows.length - MAX_ROWS, 0)}
            selected={selected}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
};

export default ElementsTree;
