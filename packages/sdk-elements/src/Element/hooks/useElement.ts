import { use } from 'react';

import ElementContext from '../ElementContext';

import type { ElementContextValue } from '../ElementContext';

const useElement = <T = unknown, T2 extends 'skipHOC' | 'full' = 'full'>() => {
  const context = use(ElementContext) as ElementContextValue<T, T2> | undefined;
  if (context === undefined) {
    throw new Error('ElementContext value is undefined. Make sure you use the ElementProvider before using the hook.');
  }

  return context;
};

export default useElement;
