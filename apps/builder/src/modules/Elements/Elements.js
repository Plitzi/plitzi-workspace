// Packages
import React, { use, useMemo, useState } from 'react';
import { ComponentContext } from '@plitzi/plitzi-sdk';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';

// Relatives
import ElementCategory from './ElementCategory';

/** @returns {React.ReactElement} */
const Elements = () => {
  const { components, componentDefinitions } = use(ComponentContext);
  const [filter, setFilter] = useState('');

  const handleChange = e => setFilter(e.target.value);

  const elementDefinitions = useMemo(() => {
    const result = [];
    Object.values(componentDefinitions).forEach(componentDefinition => {
      if (componentDefinition.definition.label.toLowerCase().includes(filter.toLowerCase())) {
        result.push(componentDefinition);
      }
    });

    return result;
  }, [components, filter]);

  const elementsSorted = useMemo(() => {
    const result = {};
    elementDefinitions
      .filter(element => element.definition.label.toLowerCase().includes(filter.toLowerCase()))
      .forEach(element => {
        const {
          market: { category }
        } = element;
        if (!result[category]) {
          result[category] = [];
        }

        result[category].push(element);
      });

    return result;
  }, [elementDefinitions, filter]);

  return (
    <div className="flex flex-col p-3 overflow-y-auto grow basis-0">
      <FormControl value={filter} type="text" placeholder="Search Elements" onChange={handleChange} />
      {Object.keys(elementsSorted).map(category => (
        <ElementCategory key={category} elements={elementsSorted[category]} category={category} />
      ))}
    </div>
  );
};

export default Elements;
