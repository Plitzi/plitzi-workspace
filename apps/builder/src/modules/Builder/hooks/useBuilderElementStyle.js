// Packages
import { use, useMemo } from 'react';
import get from 'lodash/get';

import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

// Alias
import AppContext from '@pmodules/App/AppContext';

const useBuilderElementStyle = selector => {
  const { platform } = use(BuilderStyleContext);
  const { displayMode } = use(AppContext);

  return useMemo(() => get(platform, `${displayMode}.${selector}`), [platform, selector, displayMode]);
};

export default useBuilderElementStyle;
