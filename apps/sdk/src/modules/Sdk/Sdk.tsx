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
import { createStoreHook } from '@plitzi/sdk-shared/store';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import processCssTokens from '@plitzi/sdk-style/helpers/processCssTokens';
import { schemaVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';

import IframeMode from './renderModes/IframeMode';
import RawMode from './renderModes/RawMode';
import ShadowMode from './renderModes/ShadowMode';
import SdkPlugin from './SdkPlugin';
// eslint-disable-next-line
// @ts-ignore
import style from '../../assets/index.scss?inline';

import type { Environment, RenderMode, SdkState } from '@plitzi/sdk-shared';

export type SdkProps = {
  renderMode?: RenderMode;
  externalStyle?: string;
  environment?: Environment;
  isHydrating?: boolean;
  previewMode?: boolean;
  debugMode?: boolean;
};

const Sdk = ({
  renderMode = 'iframe',
  externalStyle = '',
  environment = 'main',
  previewMode = true,
  isHydrating = false,
  debugMode = false
}: SdkProps) => {
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

    if (renderMode === 'iframe' || renderMode === 'shadow') {
      return `${style}.plitzi-sdk{${cssVariables}}\n${cacheParsed}${segmentsCss.join('')}\n${schemaSettings.customCss}\n${externalStyle}`;
    }

    return `.plitzi-sdk{${cssVariables}}\n${cacheParsed}${segmentsCss.join('')}\n${schemaSettings.customCss}\n${externalStyle}`;
  }, [segments, variables, styleCache, renderMode, schemaSettings.customCss, externalStyle]);

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
        ...schemaSettings
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
      getWindow,
      rootRef
    ]
  );

  if (renderMode === 'raw' || renderMode === 'widget') {
    return (
      <RawMode renderMode={renderMode} style={css} plitziContextValue={plitziContextValue} pageId={currentPageId} />
    );
  }

  if (renderMode === 'shadow') {
    return <ShadowMode style={css} plitziContextValue={plitziContextValue} pageId={currentPageId} assets={assets} />;
  }

  return (
    <IframeMode
      style={css}
      plitziContextValue={plitziContextValue}
      pageId={currentPageId}
      assets={assets}
      ref={iframeRef}
    />
  );
};

Sdk.Plugin = SdkPlugin;

export default Sdk;
