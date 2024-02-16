// Packages
import { useContext } from 'react';
import get from 'lodash/get';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Monorepo
import SchemaContext from '@repo/schema-shared/SchemaContext';

const useElement = id => {
  const { componentDefinitions } = useContext(ComponentContext);
  if (componentDefinitions === undefined) {
    throw new Error(
      'ComponentContext value is undefined. Make sure you use the ComponentProvider before using the hook.'
    );
  }

  const { schema } = useContext(SchemaContext);
  const element = get(schema, `flat.${id}`);

  return element;
};

export default useElement;
