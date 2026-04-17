import PlitziSdk from '@plitzi/plitzi-sdk';

import type { OfflineDataRaw, Environment, RenderMode, Server, ServerEnvironment } from '@plitzi/sdk-shared';

export type ComponentProps = {
  server: Partial<Server>;
  renderMode?: Extract<RenderMode, 'raw'>;
  environment?: Environment;
  sdkEnvironment?: ServerEnvironment;
  previewMode?: boolean;
  offlineData?: OfflineDataRaw;
};

const Component = ({
  server,
  renderMode = 'raw',
  previewMode = true,
  offlineData,
  environment = 'main',
  sdkEnvironment = 'production'
}: ComponentProps) => {
  return (
    <PlitziSdk
      children={undefined}
      environment={environment}
      server={server}
      previewMode={previewMode}
      renderMode={renderMode}
      sdkEnvironment={sdkEnvironment}
      offlineMode={!!offlineData && Object.keys(offlineData).length > 0}
      offlineData={offlineData}
    />
  );
};

export default Component;
