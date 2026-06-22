import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { use, useMemo, useRef, useCallback } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import RscProvider from '@plitzi/sdk-shared/server/rsc/RscProvider';
import { useSdkStore } from '@plitzi/sdk-shared/store';
import { ThemeContext } from '@plitzi/sdk-shared/theme';
import processCssTokens from '@plitzi/sdk-style/helpers/processCssTokens';
import { schemaVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';

import IframeMode from './renderModes/IframeMode';
import RawMode from './renderModes/RawMode';
import ShadowMode from './renderModes/ShadowMode';
import SdkPlugin from './SdkPlugin';
// eslint-disable-next-line
// @ts-ignore

import type { Environment, RenderMode, Server } from '@plitzi/sdk-shared';

export type SdkProps = {
  renderMode?: RenderMode;
  externalStyle?: string;
  environment?: Environment;
  isHydrating?: boolean;
  previewMode?: boolean;
  debugMode?: boolean;
  sdkStylePath?: string;
  server?: Server;
};

const Sdk = ({
  renderMode = 'iframe',
  externalStyle = '',
  environment = 'main',
  previewMode = true,
  isHydrating = false,
  debugMode = false,
  sdkStylePath = './plitzi-sdk.css',
  server
}: SdkProps) => {
  const { theme } = use(ThemeContext);
  const { currentPageId } = use(NavigationContext);
  const { assets } = use(PluginsContext);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { rootRef } = use(ContainerRootContext);
  const [[schemaSettings, styleCache, segments]] = useSdkStore(['schema.settings', 'style.cache', 'segments']);
  const [variables = emptyObject] = useSdkStore('runtime.sources.variables');

  const css = useMemo(() => {
    const segmentsCss = Object.values(segments).map(segment => segment.style.cache);
    const cssVariables = schemaVariablesToCss(variables);
    const cacheParsed = processCssTokens(styleCache, variables);
    const cssParsed = `.plitzi-sdk{${cssVariables}}\n${cacheParsed}${segmentsCss.join('')}\n${schemaSettings.customCss}\n${externalStyle}`;

    return `@layer plitzi-sdk-runtime{${cssParsed}}`;
  }, [segments, variables, styleCache, schemaSettings.customCss, externalStyle]);

  const getWindow = useCallback(() => {
    if (iframeRef.current) {
      return iframeRef.current.contentWindow;
    }

    if (typeof window !== 'undefined') {
      return window;
    }

    // @todo: Hmm what to put here
    return { innerWidth: 1440, innerHeight: 900 } as Window;
  }, [iframeRef]);

  const plitziContextValue = useMemo(
    () => ({
      settings: {
        isHydrating,
        previewMode,
        debugMode,
        currentPageId,
        renderMode,
        environment,
        ...schemaSettings,
        theme
      },
      root: {
        baseElementId: currentPageId
      },
      utils: {
        displayBorderComponents: false,
        getWindow,
        rootRef
      },
      customContexts: {},
      contexts: {
        ComponentContext,
        SegmentsContext,
        CollectionContext,
        NetworkContext,
        PluginsContext,
        NavigationContext,
        EventBridgeContext,
        InteractionsContext
      }
    }),
    [
      isHydrating,
      previewMode,
      debugMode,
      currentPageId,
      renderMode,
      environment,
      schemaSettings,
      theme,
      getWindow,
      rootRef
    ]
  );

  return (
    <RscProvider navigationKey={currentPageId} rscData={server?.rscData}>
      {(renderMode === 'raw' || renderMode === 'widget') && (
        <RawMode renderMode={renderMode} style={css} plitziContextValue={plitziContextValue} pageId={currentPageId} />
      )}
      {renderMode === 'shadow' && (
        <ShadowMode
          sdkStylePath={sdkStylePath}
          style={css}
          plitziContextValue={plitziContextValue}
          pageId={currentPageId}
          assets={assets}
        />
      )}
      {!['raw', 'widget', 'shadow'].includes(renderMode) && (
        <IframeMode
          style={css}
          plitziContextValue={plitziContextValue}
          pageId={currentPageId}
          assets={assets}
          ref={iframeRef}
        />
      )}
    </RscProvider>
  );
};

Sdk.Plugin = SdkPlugin;

export default Sdk;
