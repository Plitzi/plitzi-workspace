import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useState } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import PluginsContext from '@plitzi/sdk-shared/plugins/PluginsContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { REUSE } from '@pmodules/Builder/helpers/reuse';
import Components from '@pmodules/Components';

import CategoryChip from './CategoryChip';
import ElementCategory from './ElementCategory';
import { categoryDisplay, definitionsByCategory } from './ElementHelper';

/** The chip that shows the space's own components instead of a category of elements. */
const COMPONENTS = 'components';

/**
 * What can be dropped on a page: one category at a time, chosen in a row of chips — so the panel stays the same height
 * however many elements plugins add — and the space's components as one more. A search looks through all of them.
 */
const Elements = () => {
  const { componentDefinitions } = use(ComponentContext);
  // Read for its re-render only: the registry is a ref and says nothing when a plugin is installed or removed, and
  // the plugins are the state that moves with it — so an uninstalled plugin's elements leave the open catalog.
  use(PluginsContext);
  const [components = {}] = useBuilderStore('schema.components');
  const [filter, setFilter] = useState('');
  const [chosen, setChosen] = useStorage<string>('builder-state.elements.category', 'basic');

  const handleChange = useCallback((value: string) => setFilter(value), []);

  const all = definitionsByCategory(componentDefinitions.current, '');
  const searching = filter.trim() !== '';
  const found = searching ? definitionsByCategory(componentDefinitions.current, filter) : [];
  // A category a plugin took away with it is not left chosen: the first there is takes its place.
  const category = chosen === COMPONENTS || all.some(([id]) => id === chosen) ? chosen : (all.at(0)?.[0] ?? COMPONENTS);
  const shown = all.find(([id]) => id === category)?.[1] ?? [];

  return (
    <div className="flex grow basis-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 border-b border-gray-200 p-2 dark:border-zinc-800">
        <Input placeholder="Search elements" value={filter} size="sm" onChange={handleChange}>
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
        {!searching && (
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Categories">
            {all.map(([id, list]) => (
              <CategoryChip
                key={id}
                id={id}
                label={categoryDisplay(id).label}
                icon={categoryDisplay(id).icon}
                count={list.length}
                active={id === category}
                onSelect={setChosen}
              />
            ))}
            <CategoryChip
              id={COMPONENTS}
              label="Components"
              icon={REUSE.component.icon}
              count={Object.keys(components).length}
              active={category === COMPONENTS}
              onSelect={setChosen}
            />
          </div>
        )}
      </div>
      <div className="flex min-h-0 grow basis-0 flex-col gap-3 overflow-y-auto p-2">
        {!searching && category !== COMPONENTS && <ElementCategory components={shown} category={category} />}
        {!searching && category === COMPONENTS && <Components filter="" />}
        {searching && found.map(([id, list]) => <ElementCategory key={id} components={list} category={id} titled />)}
        {searching && <Components filter={filter} />}
      </div>
    </div>
  );
};

export default Elements;
