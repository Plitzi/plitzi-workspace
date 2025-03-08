// Packages
import { use, useMemo } from 'react';
import get from 'lodash/get';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/BuilderSchemaContext';

const useBuilderElement = id => {
  const { schema } = use(BuilderSchemaContext);

  return useMemo(() => get(schema, `flat.${id}`), [schema, id]);
};

export default useBuilderElement;
