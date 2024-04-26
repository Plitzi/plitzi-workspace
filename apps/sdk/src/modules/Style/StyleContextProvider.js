// Packages
import React, { useMemo, useContext } from 'react';

// Monorepo
import StyleContext from '@plitzi/sdk-style/StyleContext';

// Alias
import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';
export const STYLE_TYPE_SEGMENT = 'segment';

const StyleContextProvider = props => {
  const { children, style: styleProp, type = STYLE_TYPE_NORMAL } = props;
  const internalData = useContext(NetworkInternalContext);
  const style = useMemo(() => {
    if (styleProp) {
      return styleProp;
    }

    switch (type) {
      case STYLE_TYPE_NORMAL:
        return { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '', ...internalData.style };
      default:
        return { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' };
    }
  }, [styleProp, internalData]);

  const valueMemo = useMemo(() => ({ style }), [style]);

  return <StyleContext.Provider value={valueMemo}>{children}</StyleContext.Provider>;
};

export default StyleContextProvider;
