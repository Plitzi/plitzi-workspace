import { use } from 'react';

import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import SdkStyleContextProvider from '@plitzi/sdk-style/SdkStyleContextProvider';

import type { ReactNode } from 'react';

export type StyleContextProviderProps = {
  children: ReactNode;
};

const StyleContextProvider = ({ children }: StyleContextProviderProps) => {
  const { style } = use(NetworkInternalContext);

  return <SdkStyleContextProvider style={style}>{children}</SdkStyleContextProvider>;
};

export default StyleContextProvider;
