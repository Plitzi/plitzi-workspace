import PlitziSdk from '@plitzi/plitzi-sdk';

import type { OfflineDataRaw, Environment, RenderMode, Server, SSRPlugin, SSRRenderResult } from '@plitzi/sdk-shared';

export type ComponentProps = {
  server: Partial<Server>;
  renderMode?: Extract<RenderMode, 'raw'>;
  environment?: Environment;
  previewMode?: boolean;
  offlineData?: OfflineDataRaw;
  plugins?: Record<string, SSRPlugin>;
  ssrResult?: SSRRenderResult;
  sdkDevToolsStylePath?: string;
  debugMode?: boolean;
};

const Component = ({
  server,
  renderMode = 'raw',
  previewMode = true,
  offlineData,
  environment = 'main',
  plugins,
  ssrResult,
  sdkDevToolsStylePath,
  debugMode = false
}: ComponentProps) => {
  // The response channel travels inside the server surface rather than as a prop of its own. Merged here, after
  // `prepareRender` has already serialized `server` for the browser, so this render-only object never ships.
  const serverWithResult = { ...server, render: { ...server.render, ssrResult } };

  return (
    <PlitziSdk
      environment={environment}
      server={serverWithResult}
      previewMode={previewMode}
      renderMode={renderMode}
      offlineMode={!!offlineData && Object.keys(offlineData).length > 0}
      offlineData={offlineData}
      sdkDevToolsStylePath={sdkDevToolsStylePath}
      debugMode={debugMode}
    >
      {plugins &&
        Object.keys(plugins).map(key => (
          <PlitziSdk.Plugin key={key} renderType={key} component={plugins[key].component} {...plugins[key].props} />
        ))}
    </PlitziSdk>
  );
};

export default Component;
