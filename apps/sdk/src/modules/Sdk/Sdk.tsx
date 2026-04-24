import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { use, useMemo, useRef, useCallback } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import RscProvider from '@plitzi/sdk-shared/server/rsc/RscProvider';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import { ThemeContext } from '@plitzi/sdk-shared/theme';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import processCssTokens from '@plitzi/sdk-style/helpers/processCssTokens';
import { schemaVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';

import IframeMode from './renderModes/IframeMode';
import RawMode from './renderModes/RawMode';
import ShadowMode from './renderModes/ShadowMode';
import SdkPlugin from './SdkPlugin';
// eslint-disable-next-line
// @ts-ignore

import type { Environment, RenderMode, SdkState } from '@plitzi/sdk-shared';

export type SdkProps = {
  renderMode?: RenderMode;
  externalStyle?: string;
  environment?: Environment;
  isHydrating?: boolean;
  previewMode?: boolean;
  debugMode?: boolean;
  sdkStylePath?: string;
};

const Sdk = ({
  renderMode = 'iframe',
  externalStyle = '',
  environment = 'main',
  previewMode = true,
  isHydrating = false,
  debugMode = false,
  sdkStylePath = './plitzi-sdk.css'
}: SdkProps) => {
  const { theme } = use(ThemeContext);
  const { currentPageId } = use(NavigationContext);
  const { assets } = use(PluginsContext);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { rootRef } = use(ContainerRootContext);
  const { useStore } = createStoreHook<SdkState>();
  const [[schemaSettings, styleCache, segments]] = useStore(['schema.settings', 'style.cache', 'segments']);
  const { useDataSource } = use(DataSourceContext);
  const { sdkEnvironment } = use(NetworkContext);
  const { variables } = useDataSource<Record<string, string>>({ id: '', mode: 'read' });

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
        sdkEnvironment,
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
        DataSourceContext,
        StateManagerContext,
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
      sdkEnvironment,
      schemaSettings,
      theme,
      getWindow,
      rootRef
    ]
  );

  if (renderMode === 'raw' || renderMode === 'widget') {
    return (
      <RscProvider navigationKey={currentPageId}>
        <RawMode renderMode={renderMode} style={css} plitziContextValue={plitziContextValue} pageId={currentPageId} />
      </RscProvider>
    );
  }

  if (renderMode === 'shadow') {
    return (
      <RscProvider navigationKey={currentPageId}>
        <ShadowMode
          sdkStylePath={sdkStylePath}
          style={css}
          plitziContextValue={plitziContextValue}
          pageId={currentPageId}
          assets={assets}
        />
      </RscProvider>
    );
  }

  return (
    <RscProvider navigationKey={currentPageId}>
      <IframeMode
        style={css}
        plitziContextValue={plitziContextValue}
        pageId={currentPageId}
        assets={assets}
        ref={iframeRef}
      />
    </RscProvider>
  );
};

Sdk.Plugin = SdkPlugin;

export default Sdk;
