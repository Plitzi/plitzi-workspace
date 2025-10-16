/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useMemo, use } from 'react';

import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';

import type { Style } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

export type StyleContextProviderProps = {
  children: ReactNode;
  style?: Style;
  type?: 'normal' | 'partial' | 'template' | 'segment';
};

const StyleContextProvider = ({ children, style: styleProp, type = 'normal' }: StyleContextProviderProps) => {
  const internalData = use(NetworkInternalContext);
  const style = useMemo<Style>(() => {
    if (styleProp) {
      return styleProp;
    }

    switch (type) {
      case 'normal':
        return { variables: {}, platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '', ...internalData.style };
      default:
        return { variables: {}, platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' };
    }
  }, [styleProp, type, internalData.style]);

  const valueMemo = useMemo(() => ({ style }), [style]);

  return <StyleContext value={valueMemo}>{children}</StyleContext>;
};

export default StyleContextProvider;
