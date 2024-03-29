// Packages
import React, { useContext, useMemo, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import ComponentContext from '@modules/Component/ComponentContext';
import CollectionContext from '@modules/Collection/CollectionContext';
import NetworkContext from '@modules/Network/NetworkContext';
import SegmentsContext from '@modules/Segments/SegmentsContext';
import StateManagerContext from '@modules/StateManager/StateManagerContext';

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

const Sdk = props => {
  const { renderMode = RENDER_MODE_IFRAME, externalStyle = '', environment = 'main', previewMode = true, debugMode = false } = props;
  const { currentPageId } = useContext(NavigationContext);
  const { assets } = useContext(PluginsContext);
  const iframeRef = useRef(null);
  const { rootDOM } = useContext(ContainerRootContext);
  const schemaSettings = useContext(SchemaSettingsContext);
  const { segments } = useContext(SegmentsContext);
  const {
    style: { cache }
  } = useContext(StyleContext);
  const css = useMemo(() => {
    const segmentsCss = Object.values(segments).map(segment => segment.style.cache);

    return `${cache}${segmentsCss.join('')}\n${schemaSettings?.customCss}`;
  }, [schemaSettings?.customCss, segments, cache]);
  const styleParsed = useMemo(
    () => `${style[0][1]}\n${style[1][1]}\n${css}\n${externalStyle}`,
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
    return <RawMode style={styleParsed} plitziContextValue={plitziContextValue} pageId={currentPageId} />;
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

Sdk.propTypes = {
  children: PropTypes.node,
  environment: PropTypes.string,
  previewMode: PropTypes.bool,
  debugMode: PropTypes.bool,
  externalStyle: PropTypes.string,
  renderMode: PropTypes.oneOf([
    RENDER_MODE_RAW,
    RENDER_MODE_IFRAME,
    RENDER_MODE_SHADOW,
    RENDER_MODE_SSR,
    RENDER_MODE_WIDGET
  ])
};

Sdk.Plugin = SdkPlugin;

export default Sdk;
