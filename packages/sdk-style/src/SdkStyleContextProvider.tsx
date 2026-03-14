import { useMemo } from 'react';

import StyleContext from './StyleContext';
import { EMPTY_STYLE_SCHEMA } from './StyleMap';

import type { Style } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SdkStyleContextProviderProps = {
  children: ReactNode;
  style?: Style;
};

const SdkStyleContextProvider = ({ children, style }: SdkStyleContextProviderProps) => {
  const valueMemo = useMemo(() => ({ style: style ?? EMPTY_STYLE_SCHEMA }), [style]);

  return <StyleContext value={valueMemo}>{children}</StyleContext>;
};

export default SdkStyleContextProvider;
