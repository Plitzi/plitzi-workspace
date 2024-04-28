// Packages
import { use } from 'react';
import get from 'lodash/get';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

const useElement = id => {
  const { componentDefinitions } = use(ComponentContext);
  if (componentDefinitions === undefined) {
    throw new Error(
      'ComponentContext value is undefined. Make sure you use the ComponentProvider before using the hook.'
    );
  }

  const { schema } = use(SchemaContext);
  const element = get(schema, `flat.${id}`);

  return element;
};

export default useElement;
