// Packages
import React, { use, useMemo, useRef, useCallback } from 'react';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';

// Monorepo
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import { variablesToCss } from '@plitzi/sdk-variables/VariablesHelper';
import processCssVariables from '@plitzi/sdk-style/helpers/processCssVariables';

// Alias
import CollectionContext from '@modules/Collection/CollectionContext';
import NetworkContext from '@modules/Network/NetworkContext';
import SegmentsContext from '@modules/Segments/SegmentsContext';

// Relatives
import RawMode from './renderModes/RawMode';
import IframeMode from './renderModes/IframeMode';
import ShadowMode from './renderModes/ShadowMode';
import SdkPlugin from './SdkPlugin';

// Style
import style from '!!css-loader!postcss-loader!sass-loader!../../assets/index.scss'; // eslint-disable-line

export const RENDER_MODE_RAW = 'raw';
export const RENDER_MODE_IFRAME = 'iframe';
export const RENDER_MODE_SHADOW = 'shadow';
export const RENDER_MODE_SSR = 'ssr';
export const RENDER_MODE_WIDGET = 'widget';

/**
 * @param {{
 *   renderMode?: 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
 *   externalStyle?: string;
 *   environment?: string;
 *   previewMode?: boolean;
 *   debugMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const Sdk = props => {
  const {
    renderMode = RENDER_MODE_IFRAME,
    externalStyle = '',
    environment = 'main',
    previewMode = true,
    debugMode = false
  } = props;
  const { currentPageId } = use(NavigationContext);
  const { assets } = use(PluginsContext);
  const iframeRef = useRef(null);
  const { rootDOM } = use(ContainerRootContext);
  const schemaSettings = use(SchemaSettingsContext);
  const { segments } = use(SegmentsContext);
  const { useDataSource } = use(DataSourceContext);
  const { variables } = useDataSource({ id: '', mode: 'read' });

  const {
    style: { cache }
  } = use(StyleContext);
  const css = useMemo(() => {
    const segmentsCss = Object.values(segments).map(segment => segment.style.cache);
    const cssVariables = variablesToCss(variables);
    const cacheParsed = processCssVariables(cache, variables);

    return `.plitzi-sdk{${cssVariables}}\n${cacheParsed}${segmentsCss.join('')}\n${schemaSettings?.customCss}`;
  }, [schemaSettings?.customCss, segments, cache, variables]);
  const styleParsed = useMemo(
    () => `${style[0][1]}\n${style[0][1]}\n${css}\n${externalStyle}`,
    [style, css, externalStyle]
  );

  const getWindow = useCallback(() => {
    if (iframeRef && iframeRef.current) {
      return iframeRef.current.contentWindow;
    }

    if (typeof window !== 'undefined') {
      return window;
    }

    // @todo: Hmm what to put here
    return { innerWidth: 1440, innerHeight: 900 };
  }, [iframeRef]);

  const plitziContextValue = useMemo(
    () => ({
      settings: {
        previewMode,
        debugMode,
        currentPageId,
        renderMode,
        environment,
        ...schemaSettings
      },
      root: {
        baseElementId: currentPageId
      },
      utils: {
        displayBorderComponents: false,
        getWindow,
        rootDOM
      },
      customContexts: {},
      contexts: {
        ComponentContext,
        SchemaContext,
        SegmentsContext,
        StyleContext,
        CollectionContext,
        NetworkContext,
        PluginsContext,
        NavigationContext,
        DataSourceContext,
        StateManagerContext,
        InteractionsContext
      }
    }),
    [getWindow, currentPageId, schemaSettings]
  );

  if (renderMode === RENDER_MODE_RAW || renderMode === RENDER_MODE_SSR || renderMode === RENDER_MODE_WIDGET) {
    return (
      <RawMode
        renderMode={renderMode}
        style={styleParsed}
        plitziContextValue={plitziContextValue}
        pageId={currentPageId}
      />
    );
  }

  if (renderMode === RENDER_MODE_SHADOW) {
    return (
      <ShadowMode style={styleParsed} plitziContextValue={plitziContextValue} pageId={currentPageId} assets={assets} />
    );
  }

  return (
    <IframeMode
      style={styleParsed}
      plitziContextValue={plitziContextValue}
      pageId={currentPageId}
      assets={assets}
      ref={iframeRef}
    />
  );
};

Sdk.Plugin = SdkPlugin;

export default Sdk;
