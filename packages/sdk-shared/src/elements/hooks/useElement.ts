import { use } from 'react';

import ElementContext from '../ElementContext';

import type { ElementContextValue } from '../ElementContext';

const useElement = <T extends 'skipHOC' | 'full' = 'full'>() => {
  const context = use(ElementContext) as ElementContextValue<T> | undefined;
  if (context === undefined) {
    throw new Error('ElementContext value is undefined. Make sure you use the ElementContext before using the hook.');
  }

  return context;
};

export default useElement;
