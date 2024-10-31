// Packages
import { use, useMemo } from 'react';
import get from 'lodash/get';

// Alias
import AppContext from '@pmodules/App/AppContext';

// Relatives
import BuilderStyleContext from '../contexts/BuilderStyleContext';

const useBuilderElementStyle = selector => {
  const { platform } = use(BuilderStyleContext);
  const { displayMode } = use(AppContext);

  return useMemo(() => get(platform, `${displayMode}.${selector}`), [platform, selector, displayMode]);
};

export default useBuilderElementStyle;
