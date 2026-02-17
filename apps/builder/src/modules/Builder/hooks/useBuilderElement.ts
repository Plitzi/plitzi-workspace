import get from 'lodash-es/get';
import { use, useMemo } from 'react';

import { BuilderSchemaContext } from '@plitzi/sdk-shared';

const useBuilderElement = (id?: string) => {
  const { schema } = use(BuilderSchemaContext);

  return useMemo(() => get(schema, `flat.${id}`, undefined), [schema, id]);
};

export default useBuilderElement;
