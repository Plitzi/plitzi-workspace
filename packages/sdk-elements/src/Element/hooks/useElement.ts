import { use } from 'react';

import ElementContext from '../ElementContext';

import type { ElementContextValue } from '../ElementContext';

const useElement = () => {
  const data = use(ElementContext);
  if ((data as ElementContextValue | undefined) === undefined) {
    throw new Error(
      'Element data not found. Make sure the element is rendered under withElement — a plugin’s component is, inside a ' +
        'space: rendered alone (a test in Node), test what it works out in a .ts module beside it and what it draws in ' +
        'the browser (page play, page check, a Playwright spec).'
    );
  }

  return data as ElementContextValue;
};

export default useElement;
