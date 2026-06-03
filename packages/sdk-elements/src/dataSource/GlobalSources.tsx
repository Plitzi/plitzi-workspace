import useGlobalSources from './useGlobalSources';

import type { ReactNode } from 'react';

export type GlobalSourcesProps = {
  children: ReactNode;
  environment?: string;
};

// Mounts the global data sources at the right tree depth (under the Navigation/Auth/StateManager providers).
const GlobalSources = ({ children, environment = 'main' }: GlobalSourcesProps) => {
  useGlobalSources({ environment });

  return children;
};

export default GlobalSources;
