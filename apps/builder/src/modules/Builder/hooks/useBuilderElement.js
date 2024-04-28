// Packages
import { use } from 'react';
import get from 'lodash/get';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Alias
import BuilderSchemaContext from '../contexts/BuilderSchemaContext';

const useBuilderElement = id => {
  const { componentDefinitions } = use(ComponentContext);
  if (componentDefinitions === undefined) {
    throw new Error(
      'ComponentContext value is undefined. Make sure you use the ComponentProvider before using the hook.'
    );
  }

  const { schema } = use(BuilderSchemaContext);
  const element = get(schema, `flat.${id}`);

  return element;
};

export default useBuilderElement;
