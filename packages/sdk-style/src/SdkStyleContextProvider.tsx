import { use, useMemo } from 'react';

import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import { useBuilderStoreSync } from '@plitzi/sdk-shared/store';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';

import StyleContext from './StyleContext';

import type { Style } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SdkStyleContextProviderProps = {
  children: ReactNode;
  style?: Style;
};

const SdkStyleContextProvider = ({ children, style: styleProp }: SdkStyleContextProviderProps) => {
  const { style } = use(NetworkInternalContext);

  const valueMemo = useMemo(() => ({}), []);

  useBuilderStoreSync('style', styleProp ?? ((style as Style | undefined) ? style : EMPTY_STYLE_SCHEMA));

  return <StyleContext value={valueMemo}>{children}</StyleContext>;
};

export default SdkStyleContextProvider;
