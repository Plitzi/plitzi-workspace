import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useMemo, useState } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import ElementCategory from './ElementCategory';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

const Elements = () => {
  const { componentDefinitions } = use(ComponentContext);
  const [filter, setFilter] = useState('');

  const handleChange = useCallback((value: string) => setFilter(value), []);

  const componentsFiltered = useMemo(() => {
    const result: ComponentDefinition[] = [];
    Object.values(componentDefinitions).forEach(componentDefinition => {
      if (componentDefinition.definition.label.toLowerCase().includes(filter.toLowerCase())) {
        result.push(componentDefinition);
      }
    });

    return result;
  }, [componentDefinitions, filter]);

  const componentsSorted = useMemo(() => {
    const result: Record<string, ComponentDefinition[]> = {};
    componentsFiltered
      .filter(component => component.definition.label.toLowerCase().includes(filter.toLowerCase()))
      .forEach(component => {
        const {
          market: { category }
        } = component;
        if (!(result[category] as ComponentDefinition[] | undefined)) {
          result[category] = [];
        }

        result[category].push(component);
      });

    return result;
  }, [componentsFiltered, filter]);

  return (
    <div className="flex grow basis-0 flex-col gap-2 overflow-y-auto">
      <Input placeholder="Search Elements" value={filter} onChange={handleChange}>
        <Input.Icon icon="fa-solid fa-magnifying-glass" />
      </Input>
      {Object.keys(componentsSorted).map(category => (
        <ElementCategory key={category} components={componentsSorted[category]} category={category} />
      ))}
    </div>
  );
};

export default Elements;
