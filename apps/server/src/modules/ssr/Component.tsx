import PlitziSdk from '@plitzi/plitzi-sdk';

import type {
  OfflineDataRaw,
  Environment,
  RenderMode,
  Server,
  SSRPlugin,
  SSRRenderResult,
  Theme
} from '@plitzi/sdk-shared';

export type ComponentProps = {
  server: Partial<Server>;
  renderMode?: Extract<RenderMode, 'raw'>;
  environment?: Environment;
  previewMode?: boolean;
  offlineData?: OfflineDataRaw;
  plugins?: Record<string, SSRPlugin>;
  ssrResult?: SSRRenderResult;
  sdkDevToolsStylePath?: string;
  sdkIconsStylePath?: string;
  debugMode?: boolean;
  /** Set when the metering adapter degrades this render: the account behind this space is over its quota. */
  overQuota?: boolean;
  /** The theme this document was rendered with, from the visitor's cookie. See `prepareRender`. */
  theme?: Theme;
  /** The kept state the first paint depends on (`settings.paintedState`), from the visitor's cookie. */
  state?: Record<string, unknown>;
  /** The flags this deployment decides (`config.flags`). */
  serverFlags?: Record<string, boolean>;
  /** The flags a tester forced, for a page allowed to debug. See `prepareRender`. */
  forcedFlags?: Record<string, boolean>;
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
  sdkIconsStylePath,
  debugMode = false,
  overQuota,
  theme,
  state,
  serverFlags,
  forcedFlags
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
      sdkIconsStylePath={sdkIconsStylePath}
      debugMode={debugMode}
      {...(overQuota === undefined ? {} : { overQuota })}
      {...(theme === undefined ? {} : { theme })}
      {...(state === undefined ? {} : { state })}
      {...(serverFlags === undefined ? {} : { serverFlags })}
      {...(forcedFlags === undefined ? {} : { forcedFlags })}
    >
      {plugins &&
        Object.keys(plugins).map(key => (
          <PlitziSdk.Plugin key={key} renderType={key} component={plugins[key].component} {...plugins[key].props} />
        ))}
    </PlitziSdk>
  );
};

export default Component;
