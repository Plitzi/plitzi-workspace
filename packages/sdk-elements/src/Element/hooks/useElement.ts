/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
import { use } from 'react';

import { ElementContext } from '../ElementProvider';

import type { ElementContextValue } from '../ElementProvider';

const useElement = <T extends ElementContextValue>() => {
  const context = use(ElementContext) as T | undefined;
  if (context === undefined) {
    throw new Error('ElementContext value is undefined. Make sure you use the ElementProvider before using the hook.');
  }

  return context;
};

export default useElement;
