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
  /** Forced on when the metering adapter degrades this render; otherwise left to the SDK's own default so the
   *  markup here matches what the browser hydrates with. */
  branding?: boolean;
  /** The same degraded render, as the reason: the account behind this space is over its quota. */
  overQuota?: boolean;
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
  debugMode = false,
  branding,
  overQuota
}: ComponentProps) => {
  // The response channel travels inside the server surface rather than as a prop of its own. Merged here, after
  // `prepareRender` has already serialized `server` for the browser, so this render-only object never ships.
  const serverWithResult = { ...server, ssr: { ...server.ssr, renderResult: ssrResult } };

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
      {...(branding === undefined ? {} : { branding })}
      {...(overQuota === undefined ? {} : { overQuota })}
    >
      {plugins &&
        Object.keys(plugins).map(key => (
          <PlitziSdk.Plugin key={key} renderType={key} component={plugins[key].component} {...plugins[key].props} />
        ))}
    </PlitziSdk>
  );
};

export default Component;
