import { use } from 'react';

import { ElementContext } from '../ElementContext';

import type { ElementContextValue } from '../ElementContext';

// Reads the nearest element's resolved data from the context `withElement` provides. No `id`: the data is always the
// ambient element's, so a component never has to know (or thread) its own id to reach it.
const useElement = (): ElementContextValue => {
  const data = use(ElementContext);
  if (data === undefined) {
    throw new Error('Element data not found. Make sure the element is rendered under withElement.');
  }

  return data;
};

export default useElement;
