import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useRef, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import Components from '@pmodules/Components';

import ElementCategory from './ElementCategory';
import { definitionsByCategory } from './ElementHelper';

const Elements = () => {
  const { componentDefinitions } = use(ComponentContext);
  // Read for its re-render only: the registry is a ref and says nothing when a plugin is installed or removed, and
  // the plugins are the state that moves with it — so an uninstalled plugin's elements leave the open catalog.
  use(PluginsContext);
  const [filter, setFilter] = useState('');
  const componentsRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback((value: string) => setFilter(value), []);

  // The components sit at the foot of the catalog, under every category a plugin adds: one click away from the top.
  const handleJumpToComponents = useCallback(() => componentsRef.current?.scrollIntoView({ block: 'start' }), []);

  const byCategory = definitionsByCategory(componentDefinitions.current, filter);

  return (
    <div className="flex grow basis-0 flex-col gap-2 overflow-y-auto p-2">
      <div className="flex items-center gap-2">
        <Input className="grow" placeholder="Search" value={filter} size="sm" onChange={handleChange}>
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
        <Button
          size="sm"
          intent="secondary"
          className="shrink-0"
          title="Go to the space's components, at the foot of the catalog"
          onClick={handleJumpToComponents}
        >
          <Button.Icon icon="fa-solid fa-cube" />
        </Button>
      </div>
      {Object.keys(byCategory).map(category => (
        <ElementCategory key={category} components={byCategory[category]} category={category} />
      ))}
      <div ref={componentsRef} className="scroll-mt-2">
        <Components filter={filter} />
      </div>
    </div>
  );
};

export default Elements;
