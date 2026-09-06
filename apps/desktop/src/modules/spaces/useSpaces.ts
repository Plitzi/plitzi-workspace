import { use } from 'react';

import SpacesContext from './SpacesContext';

import type { SpacesContextValue } from './SpacesContext';

export const useSpaces = (): SpacesContextValue => {
  const value = use(SpacesContext);
  if (!value) {
    throw new Error('useSpaces was called outside SpacesProvider');
  }

  return value;
};

export default useSpaces;
