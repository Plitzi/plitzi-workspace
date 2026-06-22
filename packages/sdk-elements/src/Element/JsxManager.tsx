import { memo, use, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { getRemoteSettings } from './helpers/pluginSelector';
import PluginRemote from './PluginRemote';
import NotFound from '../elements/internal/NotFound/NotFound';

import type { ComponentPluginWithHOC, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type JsxManagerProps = {
  plitziJsxSkipHOC?: boolean;
  as: string;
  plitziJsxProps: Record<string, unknown>;
  internalProps: InternalPropsSTG1;
  children: ReactNode;
};

const JsxManager = ({
  plitziJsxSkipHOC = true,
  as: type = '',
  internalProps,
  children,
  ...plitziJsxProps
}: JsxManagerProps) => {
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { components } = use(ComponentContext);
  const { plugins } = use(PluginsContext);

  let Plugin = type ? components.current[type] : undefined;
  const remoteSettings = useMemo(
    () => (Plugin ? undefined : getRemoteSettings({ type, plugins })),
    [Plugin, plugins, type]
  );

  if (!type) {
    return null;
  }

  if (!Plugin && remoteSettings) {
    return (
      <PluginRemote
        internalProps={internalProps}
        url={remoteSettings.url}
        scope={remoteSettings.scope}
        plitziJsxSkipHOC={plitziJsxSkipHOC}
        plitziJsxProps={plitziJsxProps}
      />
    );
  }

  if (!Plugin) {
    Plugin = NotFound as ComponentPluginWithHOC;
  }

  return (
    <Plugin plitziJsxSkipHOC={plitziJsxSkipHOC} {...plitziJsxProps} internalProps={internalProps}>
      {children}
    </Plugin>
  );
};

export default memo(JsxManager);
