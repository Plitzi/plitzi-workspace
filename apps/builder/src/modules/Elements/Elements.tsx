import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import ElementCategory from './ElementCategory';
import { definitionsByCategory } from './ElementHelper';

const Elements = () => {
  const { componentDefinitions } = use(ComponentContext);
  // Read for its re-render only: the registry is a ref and says nothing when a plugin is installed or removed, and
  // the plugins are the state that moves with it — so an uninstalled plugin's elements leave the open catalog.
  use(PluginsContext);
  const [filter, setFilter] = useState('');

  const handleChange = useCallback((value: string) => setFilter(value), []);

  const byCategory = definitionsByCategory(componentDefinitions.current, filter);

  return (
    <div className="flex grow basis-0 flex-col gap-2 overflow-y-auto p-2">
      <Input placeholder="Search Elements" value={filter} size="sm" onChange={handleChange}>
        <Input.Icon icon="fa-solid fa-magnifying-glass" />
      </Input>
      {Object.keys(byCategory).map(category => (
        <ElementCategory key={category} components={byCategory[category]} category={category} />
      ))}
    </div>
  );
};

export default Elements;
