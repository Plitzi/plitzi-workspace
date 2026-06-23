import { use } from 'react';

import { ElementContext } from '../ElementContext';

import type { ElementContextValue } from '../ElementContext';

// Reads the ambient element's resolved data from the context `withElement` provides. `id` is accepted (and used only
// to enrich the error) so the historical `useElement(id)` call sites — including remote plugins that receive `id` as a
// prop — keep working unchanged; the data itself is always the ambient element's.
const useElement = (id?: string): ElementContextValue => {
  const data = use(ElementContext);
  if (data === undefined) {
    throw new Error(
      `Element data${id ? ` for "${id}"` : ''} not found. Make sure the element is rendered under withElement.`
    );
  }

  return data;
};

export default useElement;
