import Heading from '@plitzi/plitzi-ui/Heading';
import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import Element from './Element';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

export type ElementCategoryProps = {
  components?: ComponentDefinition[];
  category?: string;
};

const ElementCategory = ({ components, category = '' }: ElementCategoryProps) => {
  const componentsToRender = useMemo(
    () => components?.filter(component => get(component, 'builder.canDragDrop', true)),
    [components]
  );

  if (componentsToRender?.length === 0) {
    return undefined;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-t border-gray-200" />
      <Heading as="h6" className="capitalize">
        {category}
      </Heading>
      <div className="flex flex-wrap gap-2">
        {componentsToRender?.map((component, key) => (
          <Element key={key} component={component} />
        ))}
      </div>
    </div>
  );
};

export default ElementCategory;
