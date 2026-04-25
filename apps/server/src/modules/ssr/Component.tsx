import PlitziSdk from '@plitzi/plitzi-sdk';

import type { OfflineDataRaw, Environment, RenderMode, Server, ServerEnvironment } from '@plitzi/sdk-shared';
import type { FC } from 'react';

export type ComponentProps = {
  server: Partial<Server>;
  renderMode?: Extract<RenderMode, 'raw'>;
  environment?: Environment;
  sdkEnvironment?: ServerEnvironment;
  previewMode?: boolean;
  offlineData?: OfflineDataRaw;
  plugins?: Record<string, FC>;
};

const Component = ({
  server,
  renderMode = 'raw',
  previewMode = true,
  offlineData,
  environment = 'main',
  sdkEnvironment = 'production',
  plugins
}: ComponentProps) => {
  return (
    <PlitziSdk
      environment={environment}
      server={server}
      previewMode={previewMode}
      renderMode={renderMode}
      sdkEnvironment={sdkEnvironment}
      offlineMode={!!offlineData && Object.keys(offlineData).length > 0}
      offlineData={offlineData}
    >
      {plugins &&
        Object.keys(plugins).map(key => <PlitziSdk.Plugin key={key} renderType={key} component={plugins[key]} />)}
    </PlitziSdk>
  );
};

export default Component;
