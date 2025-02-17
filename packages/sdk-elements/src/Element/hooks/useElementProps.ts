import get from 'lodash/get';
import pick from 'lodash/pick';
import { useMemo } from 'react';

import type { Element, Schema } from '@plitzi/sdk-shared';

const useElementProps = (id: string, schema: Schema) => {
  const elementProps = useMemo(
    () => pick(get(schema, `flat.${id}`, { attributes: {}, definition: {} }), ['attributes', 'definition']),
    [schema, id]
  );

  return elementProps as { attributes: Element['attributes']; definition: Element['definition'] };
};

export default useElementProps;
