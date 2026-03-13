import { useMemo } from 'react';

import StyleContext from './StyleContext';
import { EMPTY_STYLE_SCHEMA } from './StyleMap';

import type { Style } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StyleContextProviderProps = {
  children: ReactNode;
  style?: Style;
  type?: 'normal' | 'partial' | 'template' | 'segment';
};

const StyleContextProvider = ({ children, style: styleProp, type = 'normal' }: StyleContextProviderProps) => {
  const style = useMemo<Style>(() => {
    switch (type) {
      case 'normal': {
        const { variables = {}, platform = { desktop: {}, tablet: {}, mobile: {} }, cache = '' } = styleProp ?? {};

        return { variables, platform, cache } as Style;
      }

      default:
        return EMPTY_STYLE_SCHEMA;
    }
  }, [styleProp, type]);

  const valueMemo = useMemo(() => ({ style }), [style]);

  return <StyleContext value={valueMemo}>{children}</StyleContext>;
};

export default StyleContextProvider;
