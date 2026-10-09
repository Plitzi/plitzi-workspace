import { memo, use } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import PluginsContext from '@plitzi/sdk-shared/plugins/PluginsContext';

import pluginSelector from './helpers/pluginSelector';

import type { InternalPropsSTG0, ElementLayout } from '@plitzi/sdk-shared';

export type PluginManagerProps = {
  plitziElementLayout?: ElementLayout;
  type: string;
  internalProps: InternalPropsSTG0;
};

const PluginManager = ({ plitziElementLayout = undefined, type = '', internalProps }: PluginManagerProps) => {
  const { components } = use(ComponentContext);
  const { plugins } = use(PluginsContext);

  return pluginSelector({
    type,
    internalProps: { ...internalProps, plitziElementLayout },
    plitziElementLayout,
    components: components.current,
    plugins
  });
};

export default memo(PluginManager);
