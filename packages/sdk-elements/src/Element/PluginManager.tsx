import { memo, use, useMemo } from 'react';

import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { PluginsContext } from '@plitzi/sdk-shared/plugins/react';

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
  // The element's props kept while what they hold is: rebuilt on every render, the element drawn here rendered again
  // whenever this did — a context it reads (the plugins arriving) — with nothing of its own changed. Every component
  // instance's root did, twice on each load of the docs.
  const props = useMemo(() => ({ ...internalProps, plitziElementLayout }), [internalProps, plitziElementLayout]);

  return pluginSelector({ type, internalProps: props, components: components.current, plugins });
};

export default memo(PluginManager);
