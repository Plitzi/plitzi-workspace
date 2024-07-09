// Packages
import { useMemo } from 'react';
import get from 'lodash/get';

const useElementProps = (id, schema) => {
  const { attributes, definition } = useMemo(
    () => get(schema, `flat.${id}`, { attributes: {}, definition: {} }),
    [schema, id]
  );

  return {
    attributes,
    definition
  };
};

export default useElementProps;
