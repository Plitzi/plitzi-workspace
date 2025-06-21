import get from 'lodash/get';
import { use, useMemo } from 'react';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';

const useBuilderElement = (id?: string) => {
  const { schema } = use(BuilderSchemaContext);

  return useMemo(() => get(schema, `flat.${id}`), [schema, id]);
};

export default useBuilderElement;
