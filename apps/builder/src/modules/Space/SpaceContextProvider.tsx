import { useMemo } from 'react';

import SpaceContext from './SpaceContext';

import type { ReactNode } from 'react';

export type SpaceContextProviderProps = {
  children?: ReactNode;
};

const SpaceContextProvider = ({ children }: SpaceContextProviderProps) => {
  const valueMemo = useMemo(() => ({}), []);

  return <SpaceContext value={valueMemo}>{children}</SpaceContext>;
};

export default SpaceContextProvider;
