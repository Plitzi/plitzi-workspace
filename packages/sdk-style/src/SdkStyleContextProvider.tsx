import { use, useMemo } from 'react';

import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import StyleContext from './StyleContext';

import type { BuilderState, Style } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SdkStyleContextProviderProps = {
  children: ReactNode;
  style?: Style;
};

const SdkStyleContextProvider = ({ children, style: styleProp }: SdkStyleContextProviderProps) => {
  const { style } = use(NetworkInternalContext);

  const valueMemo = useMemo(() => ({}), []);

  const { useStoreSync } = createStoreHook<BuilderState>();
  useStoreSync('style', styleProp ?? ((style as Style | undefined) ? style : EMPTY_STYLE_SCHEMA));

  return <StyleContext value={valueMemo}>{children}</StyleContext>;
};

export default SdkStyleContextProvider;
