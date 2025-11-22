import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import pick from 'lodash-es/pick.js';
import { useMemo } from 'react';

import type { Element, Schema } from '@plitzi/sdk-shared';

const useElementProps = (id: string, schema: Schema) => {
  const element = useValueMemo(schema.flat[id] as Element | undefined);
  const elementProps = useMemo(
    () => pick(element ?? { attributes: {}, definition: {} }, ['attributes', 'definition']),
    [element]
  );

  return elementProps as { attributes: Element['attributes']; definition: Element['definition'] };
};

export default useElementProps;
