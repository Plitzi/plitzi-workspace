import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { use, useCallback, useEffect, useMemo, useRef } from 'react';

import { useResolvedVariables } from '@plitzi/sdk-elements/dataSource';
import { PluginAssetsContext } from '@plitzi/sdk-shared/plugins/react';
import { useActionsSync, useImagesSync, useRealtimeSync, useRscSync } from '@plitzi/sdk-shared/server';
import { useRenderSettings, useSdkStore } from '@plitzi/sdk-shared/store';
import {
  fontLinkAssets,
  fontsToHead,
  fontUrlResolver,
  PLUGIN_CSS_LAYER,
  RUNTIME_CSS_LAYER,
  STYLE_SHEET_ID
} from '@plitzi/sdk-shared/style';
import { processCssTokens } from '@plitzi/sdk-style/helpers';
import { schemaVariablesToCss } from '@plitzi/sdk-variables';

import IframeMode from './renderModes/IframeMode';
import RawMode from './renderModes/RawMode';
import ShadowMode from './renderModes/ShadowMode';
import { scopeSpaceCss } from './scopeSpaceCss';
import SdkPlugin from './SdkPlugin';
import FontFaces from '../Fonts/FontFaces';

import type { Server, SpaceFont } from '@plitzi/sdk-shared';

export type SdkProps = {
  externalStyle?: string;
  sdkStylePath?: string;
  server?: Server;
};

/** Module-level, so a space that declares no font of its own keeps one reference across every render. */
const NO_FONTS: SpaceFont[] = [];

const Sdk = ({ externalStyle = '', sdkStylePath = './plitzi-sdk.css', server }: SdkProps) => {
  const { assets } = use(PluginAssetsContext);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { rootRef } = use(ContainerRootContext);
  const [[schemaSettings, styleCache, styleCacheHref, currentPageId, fonts = NO_FONTS]] = useSdkStore([
    'schema.settings',
    'style.cache',
    'style.cacheHref',
    'navigation.currentPageId',
    'style.fonts'
  ]);
  // Resolved here, not read from `runtime.sources.variables`: that is published below this, while the page renders,
  // and the server would write this sheet without the variables that the browser hydrates it with.
  const variables = useResolvedVariables();
  const { renderMode, previewMode, debugMode, environment, enclosed } = useRenderSettings();
  useRscSync(server?.ssr);
  useActionsSync(server?.ssr);
  useRealtimeSync(server?.ssr);
  useImagesSync(server?.ssr);

  /**
   * What the space's declared families cost the document, resolved once for all three surfaces.
   *
   * The style cache names families; nothing in it asks for one. Until this existed the only request for a face
   * came from a hard-coded list on the client asset rail, which meant a published page — rendered raw, where the
   * rail is not applied at all — showed every space in its fallback.
   */
  const fontHead = useMemo(
    () => fontsToHead(fonts, fontUrlResolver(server?.fontsBaseUrl), server?.googleFontsUrl),
    [fonts, server?.fontsBaseUrl, server?.googleFontsUrl]
  );

  /**
   * The compiled stylesheet as the file a server-rendered page links in its head (`style.cacheHref`), instead of
   * drawing it: the document carries none of it. Only a page drawn raw at the top of the document — a space enclosed in
   * another scopes its rules to itself, and the other modes draw into a document of their own.
   */
  const linked = Boolean(styleCacheHref) && styleCache === '' && !enclosed && renderMode === 'raw';

  const css = useMemo(() => {
    const cssVariables = `.plitzi-sdk{${schemaVariablesToCss(variables)}}`;
    const own = `${schemaSettings.customCss}\n${externalStyle}`;
    const body = linked
      ? `${cssVariables}\n${own}`
      : `${cssVariables}\n${processCssTokens(styleCache, variables)}\n${own}`;

    // The order said again before the block, for a page that loads no `plitzi-sdk.css` to say it first: a plugin's
    // stylesheet arriving later would otherwise land in a layer of its own above the space's.
    return `@layer ${PLUGIN_CSS_LAYER}, ${RUNTIME_CSS_LAYER};@layer ${RUNTIME_CSS_LAYER}{${enclosed ? scopeSpaceCss(body) : body}}`;
  }, [variables, styleCache, schemaSettings.customCss, externalStyle, enclosed, linked]);

  // Drawn in the page from here on — new documents in the browser, the builder taking the page over: the head's
  // linked copy goes, or rules the space no longer has would still apply under the new ones.
  useEffect(() => {
    if (!linked) {
      document.getElementById(STYLE_SHEET_ID)?.remove();
    }
  }, [linked]);

  // The canvas renders into an iframe, whose head only the rail can reach.
  const iframeAssets = useMemo(() => ({ ...assets, ...fontLinkAssets(fontHead) }), [assets, fontHead]);

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

  /**
   * The element being edited, which only means something outside preview: every element reads this context, so a
   * value that followed the page re-rendered the whole tree — shell included — on every navigation. A published page
   * reads the current page from `navigation.currentPageId` instead, where only its own readers subscribe.
   */
  const baseElementId = previewMode ? '' : currentPageId;
  const plitziContextValue = useMemo(
    () => ({
      settings: {
        previewMode,
        debugMode,
        renderMode,
        environment,
        ...schemaSettings
      },
      root: {
        baseElementId
      },
      utils: {
        displayBorderComponents: false,
        getWindow,
        rootRef
      }
    }),
    [previewMode, debugMode, baseElementId, renderMode, environment, schemaSettings, getWindow, rootRef]
  );

  return (
    <>
      {/* Not for the iframe: its page is a document of its own, and its head is fed through the asset rail.
          Every other mode paints into THIS document, shadow included — a `@font-face` inside a shadow root is
          ignored, so the faces belong in the head whatever the markup's scope is. */}
      {renderMode !== 'iframe' && <FontFaces head={fontHead} />}
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
          style={fontHead.faces ? `${fontHead.faces}\n${css}` : css}
          plitziContextValue={plitziContextValue}
          pageId={currentPageId}
          assets={iframeAssets}
          ref={iframeRef}
        />
      )}
    </>
  );
};

Sdk.Plugin = SdkPlugin;

export default Sdk;
