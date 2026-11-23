import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { memo, useCallback, use, useEffect, useMemo, useRef, useState } from 'react';

import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { PlitziProvider } from '@plitzi/sdk-shared/hooks';
import { PluginAssetsContext } from '@plitzi/sdk-shared/plugins/react';
import { EnclosingSpaceContext } from '@plitzi/sdk-shared/react';
import { isMotionAnimation } from '@plitzi/sdk-shared/schema';
import { ownHtml } from '@plitzi/sdk-shared/security';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { fontLinkAssets, fontsToHead, fontUrlResolver, layoutGridCss } from '@plitzi/sdk-shared/style';
import { useTheme, SPACE_THEME_AREA } from '@plitzi/sdk-shared/theme/react';
import { processCssTokens } from '@plitzi/sdk-style/helpers';
import { schemaVariablesToCss } from '@plitzi/sdk-variables';
import AppContext from '@pmodules/App/AppContext';
import BuilderContextMenu from '@pmodules/Builder/components/BuilderContextMenu';
import { canvasIconsAssets } from '@pmodules/Builder/helpers/canvasIcons';
import { collaboratorTitle } from '@pmodules/Collaboration/CollaborationHelper';
import CollaboratorArea from '@pmodules/Collaboration/components/CollaboratorArea';
import { fontsBaseUrl } from '@pmodules/Fonts/fontsBaseUrl';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import SpaceContainer from '@pmodules/Space/SpaceContainer';
import { useCanvasStudio } from '@pmodules/Tests';

import BuilderAreaHeader from './BuilderAreaHeader';
import BuilderAreaOverlay from './BuilderAreaOverlay';
import BuilderAreaTracking from './BuilderAreaTracking';
import { canvasMotionCss } from './canvasMotionCss';
import { liveCanvas } from './liveCanvas';
import styleFrame from '../../Assets/index-iframe.scss?inline';

import type { ComponentPluginWithHOC, DisplayMode, SpaceFont } from '@plitzi/sdk-shared';
import type { ComponentGround } from '@pmodules/Components/preview';

/** Module-level, so a space that declares no font of its own keeps one reference across every render. */
const NO_FONTS: SpaceFont[] = [];

export type BuilderAreaProps = {
  className?: string;
  customCss?: string;
  externalStyle?: string;
  displayMode?: DisplayMode;
  showHeader?: boolean;
  headerTitle?: string;
  mobilePreview?: boolean;
  previewMode?: boolean;
  debugMode?: boolean;
  /** The canvas alone, its frame — size, padding, shadow — drawn by whoever places it: the Tests area's devices. */
  bare?: boolean;
  /** What a component open in the canvas is drawn on: the ground around the instance it is shown as. */
  ground?: ComponentGround;
  /** A canvas the test studio plays in; a thumbnail is never one, and taking it over would leave the studio none. */
  studio?: boolean;
};

/** The frame a canvas that is not the studio's hands it: none. */
const NO_FRAME = { current: null };

const BuilderArea = ({
  className = '',
  customCss = '',
  externalStyle = '',
  displayMode = 'desktop',
  showHeader = true,
  headerTitle = '',
  mobilePreview = false,
  previewMode = false,
  debugMode = false,
  bare = false,
  ground,
  studio = true
}: BuilderAreaProps) => {
  const [cache] = useBuilderStore('style.cache');
  const [fonts = NO_FONTS] = useBuilderStore('style.fonts');
  // @todo: variables should be only related to styles
  const [variables] = useBuilderStore('runtime.sources.variables');
  const trackingContainerRef = useRef<HTMLDivElement | null>(null);
  const { assets } = use(PluginAssetsContext);
  const { server } = useBuilderNetwork();
  const {
    multiPagesMode,
    mode,
    baseContext: { baseElementId },
    builderGetBaseElement
  } = use(BuilderContext);
  // The scheme the SPACE is painted in — see the `canvas` area in `themeStore`. Not the editor's own.
  const { resolvedTheme } = useTheme(SPACE_THEME_AREA);
  const { displayBorderComponents, displayGrid, motionPlaying, motionReplays, pageLoads, zoom, sdkIconsStylePath } =
    use(AppContext);
  /**
   * The families the space declares, resolved for the canvas the same way the published page resolves them.
   *
   * The canvas is a document of its own, so nothing the editor's own page loads reaches it. It used to be fed a
   * fixed list of eighteen Google families at one weight, which is why a design looked right here and shipped in a
   * fallback — and why a bold in the canvas was the browser's synthetic one.
   */
  const fontHead = useMemo(() => fontsToHead(fonts, fontUrlResolver(fontsBaseUrl(server))), [fonts, server]);
  // The icons first: the SDK's layer order opens their sheet, and the first stylesheet to name a layer places it.
  const canvasAssets = useMemo(
    () => ({ ...canvasIconsAssets(sdkIconsStylePath), ...assets, ...fontLinkAssets(fontHead) }),
    [sdkIconsStylePath, assets, fontHead]
  );

  const css = useMemo(() => {
    const cssVariables = schemaVariablesToCss(variables as Record<string, string>);
    const cacheParsed = processCssTokens(cache, variables as Record<string, string>);

    // The faces stay outside the layer: they declare what a family IS, and nothing in the cascade competes with them.
    return `${fontHead.faces}\n:root{${cssVariables}}\n${styleFrame}\n@layer plitzi-builder-runtime{${cacheParsed}\n${customCss}\n${externalStyle}}`;
  }, [customCss, cache, externalStyle, variables, fontHead.faces]);
  // Apart from the space's own CSS, so turning the grid on or zooming does not process the whole stylesheet again.
  const frameCss = useMemo(
    () =>
      [css, displayGrid && layoutGridCss(zoom), canvasMotionCss(previewMode, motionPlaying)].filter(Boolean).join('\n'),
    [css, displayGrid, motionPlaying, previewMode, zoom]
  );
  const [iframeActive, setIframeActive] = useState(!multiPagesMode);
  const ref = useRef<HTMLIFrameElement>(null);
  // The canvas an e2e test open in the studio is played and recorded in.
  useCanvasStudio(studio ? ref : NO_FRAME);
  const refContainer = useRef<HTMLDivElement>(null);

  // Replaying restarts what is already running: an arrival that played once sits finished, and turning the motion on
  // again would not move it. Reading the animations flushes the frame's styles, so the ones just turned on are there.
  useEffect(() => {
    if (motionReplays === 0) {
      return;
    }

    const frameDocument = ref.current?.contentDocument ?? document;
    for (const animation of frameDocument.getAnimations()) {
      if (isMotionAnimation(animation)) {
        animation.cancel();
        animation.play();
      }
    }
  }, [motionReplays]);

  // In preview the canvas is the page; while Play runs, it plays like one. The frame's document is replaced when it
  // loads, so it is made live again.
  useEffect(() => {
    if (!previewMode && !motionPlaying) {
      return undefined;
    }

    const frame = ref.current;
    // A frame mounted anew holds a document still being made, with no root yet — `documentElement` is typed as always
    // there and is not, `:root` asked says so: it is made live once its `load` brings the document that stays.
    const live = (): (() => void) => {
      const root = (frame?.contentDocument ?? document).querySelector(':root');

      return root ? liveCanvas(root, { reveal: previewMode }) : () => undefined;
    };
    let stop = live();
    const follow = (): void => {
      stop();
      stop = live();
    };
    frame?.addEventListener('load', follow);

    return () => {
      frame?.removeEventListener('load', follow);
      stop();
    };
  }, [previewMode, motionPlaying, iframeActive]);
  const { supportRealTime } = use(BuilderSubscriptionsContext);
  const [[collaborators, currentPageId]] = useBuilderStore(['collaboration.collaborators', 'navigation.currentPageId']);
  const { rootRef } = use(ContainerRootContext);

  const getWindow = useCallback(() => {
    if (ref.current) {
      return ref.current.contentWindow;
    }

    if (typeof window !== 'undefined') {
      return window;
    }

    // @todo: Hmm what to put here
    return { innerWidth: 1440, innerHeight: 900 } as Window;
  }, []);

  const baseElement = builderGetBaseElement(baseElementId);
  const baseElementData = get(baseElement, 'data');
  const Plugin = get(baseElement, 'Plugin') as ComponentPluginWithHOC | undefined;

  const plitziContextValue = useMemo(
    () => ({
      settings: {
        previewMode,
        debugMode,
        currentPageId,
        environment: 'main',
        theme: resolvedTheme
      },
      root: { baseElementId },
      utils: { displayBorderComponents, getWindow, rootRef }
    }),
    [previewMode, debugMode, currentPageId, resolvedTheme, baseElementId, displayBorderComponents, getWindow, rootRef]
  );

  const baseElementValueMemo = useMemo(() => ({ id: baseElementId, rootId: baseElementId }), [baseElementId]);
  /**
   * A layout edited on its own, drawn in the box of the page it is edited from — as a visitor sees it, where the page
   * holds the layout. One that leaves its box to the page (`display: contents`, the page a column) otherwise laid its
   * parts along the canvas's own row: the footer beside the bar.
   */
  const [page = undefined] = useBuilderStore(`schema.flat.${currentPageId}`);
  const pageBox =
    Plugin && baseElementData.definition.type === 'layoutContainer' && page?.definition.type === 'page'
      ? clsx('plitzi-component__page', 'plitzi__page', page.definition.styleSelectors.base)
      : undefined;
  /**
   * A component edited on its own, drawn on the ground of the instance it is shown as: one made for a dark band has
   * white words, and on the canvas's own white the canvas read as blank.
   */
  const groundStyle = useMemo(
    () =>
      ground && (ground.background !== undefined || ground.color !== undefined)
        ? // The canvas lays its root in a row: the ground takes the row whole, the root its own size in it.
          {
            display: 'flex',
            alignItems: 'flex-start',
            background: ground.background,
            color: ground.color,
            minHeight: '100vh',
            flexGrow: 1,
            minWidth: 0
          }
        : undefined,
    [ground]
  );

  return (
    <div
      className={clsx(
        'builder-area flex flex-col select-none',
        {
          'min-w-150 overflow-hidden': multiPagesMode,
          'basis-0 overflow-auto': !multiPagesMode && !mobilePreview,
          grow: !mobilePreview && !mobilePreview,
          'px-4 pt-4 pb-2': mode === 'normal' && !bare,
          'p-2': mode !== 'normal' && !bare,
          'max-w-360': displayMode === 'desktop' && !bare,
          'max-w-3xl': displayMode === 'tablet' && !bare,
          'max-w-106.25': displayMode === 'mobile' && !bare
        },
        className
      )}
    >
      <div className={clsx('flex w-full grow basis-0 flex-col', { 'mx-auto mb-2 shadow': !bare })}>
        {mode === 'normal' && showHeader && (
          <BuilderAreaHeader
            baseElementId={baseElementId}
            element={baseElementData}
            isActive={iframeActive}
            headerTitle={headerTitle}
            previewMode={previewMode}
          />
        )}
        <div
          id="builder-area"
          ref={refContainer}
          className="relative flex h-full w-full flex-col"
          onMouseEnter={() => {
            setIframeActive(true);
          }}
          onMouseLeave={() => {
            setIframeActive(!multiPagesMode || false);
          }}
        >
          <ContainerFrame
            ref={ref}
            trustedHtml={ownHtml}
            id={`i-builder-${baseElementId}`}
            css={frameCss}
            assets={canvasAssets}
            className="absolute h-full w-full origin-top-left"
            style={{ colorScheme: resolvedTheme }}
          >
            {Plugin && (
              <>
                <BuilderAreaTracking
                  className="builder-iframe"
                  ref={trackingContainerRef}
                  zoom={zoom}
                  isActive={iframeActive}
                  iframeDOM={ref.current}
                  previewMode={previewMode}
                >
                  {/* Keyed by the preview's reloads: a reload draws the space anew, as a browser's F5 loads the page
                      again — its loads, its providers and its first flows run once more. */}
                  <SpaceContainer key={pageLoads}>
                    {/* The canvas is a space drawn by the editor: one drawn inside it leaves the editor's document be. */}
                    <EnclosingSpaceContext value>
                      <PlitziProvider value={plitziContextValue}>
                        {/* No key on the base element: a key here remounts the whole canvas on every page
                            switch, and the layout shell is rendered inside the page — so two pages naming the
                            same `layoutContainer` rebuilt it anyway. `Plugin` is resolved per base element, so
                            switching to a root of a different KIND still changes the component type and remounts;
                            page to page keeps the shell and swaps only the body. */}
                        {pageBox && (
                          <div className={pageBox}>
                            <Plugin internalProps={baseElementValueMemo} />
                          </div>
                        )}
                        {!pageBox && groundStyle && (
                          <div style={groundStyle}>
                            <Plugin internalProps={baseElementValueMemo} />
                          </div>
                        )}
                        {!pageBox && !groundStyle && <Plugin internalProps={baseElementValueMemo} />}
                      </PlitziProvider>
                    </EnclosingSpaceContext>
                  </SpaceContainer>

                  {!previewMode && (
                    <BuilderAreaOverlay
                      baseElementId={baseElementId}
                      refIframe={ref}
                      displayMode={displayMode}
                      zoom={zoom}
                      previewMode={previewMode}
                    />
                  )}
                  {supportRealTime &&
                    !previewMode &&
                    collaborators.map(collaborator => (
                      <CollaboratorArea
                        key={collaborator.instanceId}
                        instanceId={collaborator.instanceId}
                        debugMode={debugMode}
                        elementState={collaborator.elementState}
                        trackingContainerRef={trackingContainerRef}
                        refIframe={ref}
                        baseElementId={baseElementId}
                        color={collaborator.color}
                        title={collaboratorTitle(collaborator)}
                        displayMode={displayMode}
                        zoom={zoom}
                      />
                    ))}
                </BuilderAreaTracking>
              </>
            )}
          </ContainerFrame>
          {!previewMode && iframeActive && (
            <BuilderContextMenu iframeDOM={ref.current} getWindow={getWindow} zoom={zoom} />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(BuilderArea);
