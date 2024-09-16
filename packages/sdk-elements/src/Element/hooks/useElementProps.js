// Packages
import { useMemo } from 'react';
import get from 'lodash/get';
import pick from 'lodash/pick';

const useElementProps = (id, schema) => {
  const elementProps = useMemo(
    () => pick(get(schema, `flat.${id}`, { attributes: {}, definition: {} }), ['attributes', 'definition']),
    [schema, id]
  );

  return elementProps;
};

export default useElementProps;
