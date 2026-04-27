import PlitziSdk from '@plitzi/plitzi-sdk';

import type { OfflineDataRaw, Environment, RenderMode, Server, SSRPlugin } from '@plitzi/sdk-shared';

export type ComponentProps = {
  server: Partial<Server>;
  renderMode?: Extract<RenderMode, 'raw'>;
  environment?: Environment;
  previewMode?: boolean;
  offlineData?: OfflineDataRaw;
  plugins?: Record<string, SSRPlugin>;
};

const Component = ({
  server,
  renderMode = 'raw',
  previewMode = true,
  offlineData,
  environment = 'main',
  plugins
}: ComponentProps) => {
  return (
    <PlitziSdk
      environment={environment}
      server={server}
      previewMode={previewMode}
      renderMode={renderMode}
      offlineMode={!!offlineData && Object.keys(offlineData).length > 0}
      offlineData={offlineData}
    >
      {plugins &&
        Object.keys(plugins).map(key => (
          <PlitziSdk.Plugin key={key} renderType={key} component={plugins[key].component} {...plugins[key].props} />
        ))}
    </PlitziSdk>
  );
};

export default Component;
