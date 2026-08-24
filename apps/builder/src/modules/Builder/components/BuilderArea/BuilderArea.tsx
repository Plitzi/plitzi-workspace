import { HelmetProvider } from '@dr.pogodin/react-helmet';
import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { get } from '@plitzi/plitzi-ui/helpers';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { memo, useCallback, use, useMemo, useRef, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { useResolvedScheme } from '@plitzi/sdk-shared/theme';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import processCssTokens from '@plitzi/sdk-style/helpers/processCssTokens';
import { schemaVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';
import AppContext from '@pmodules/App/AppContext';
import BuilderContextMenu from '@pmodules/Builder/components/BuilderContextMenu';
import CollaboratorArea from '@pmodules/Collaboration/components/CollaboratorArea';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import SpaceContainer from '@pmodules/Space/SpaceContainer';

import BuilderAreaHeader from './BuilderAreaHeader';
import BuilderAreaOverlay from './BuilderAreaOverlay';
import BuilderAreaTracking from './BuilderAreaTracking';
// eslint-disable-next-line
// @ts-ignore
import styleFrame from '../../Assets/index-iframe.scss?inline';

import type { ComponentPluginWithHOC, DisplayMode, Theme } from '@plitzi/sdk-shared';

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
};

const BuilderArea = ({
  className = '',
  customCss = '',
  externalStyle = '',
  displayMode = 'desktop',
  showHeader = true,
  headerTitle = '',
  mobilePreview = false,
  previewMode = false,
  debugMode = false
}: BuilderAreaProps) => {
  const [cache] = useBuilderStore('style.cache');
  // @todo: variables should be only related to styles
  const [variables] = useBuilderStore('runtime.sources.variables');
  const trackingContainerRef = useRef<HTMLDivElement | null>(null);
  const { assets } = use(PluginsContext);
  const {
    multiPagesMode,
    mode,
    baseContext: { baseElementId },
    builderGetBaseElement
  } = use(BuilderContext);
  const { theme } = use(ThemeContext);
  const [themeArea, setThemeArea] = useStorage<Theme>('builder-state.theme-builder', theme, 'localStorage');

  // The canvas paints one scheme. `system` is the space asking for the machine's answer, not for light.
  const resolvedTheme = useResolvedScheme(themeArea);
  const { displayBorderComponents, zoom } = use(AppContext);
  const css = useMemo(() => {
    const cssVariables = schemaVariablesToCss(variables as Record<string, string>);
    const cacheParsed = processCssTokens(cache, variables as Record<string, string>);

    return `:root{${cssVariables}}\n${styleFrame}\n@layer plitzi-builder-runtime{${cacheParsed}\n${customCss}\n${externalStyle}}`;
  }, [customCss, cache, externalStyle, variables]);
  const [iframeActive, setIframeActive] = useState(!multiPagesMode);
  const ref = useRef<HTMLIFrameElement>(null);
  const refContainer = useRef<HTMLDivElement>(null);
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
      utils: { displayBorderComponents, getWindow, rootRef },
      customContexts: {},
      contexts: {
        ComponentContext,
        ContainerRootContext,
        SegmentsContext,
        NetworkContext,
        PluginsContext,
        InteractionsContext,
        EventBridgeContext,
        BuilderContext
      }
    }),
    [previewMode, debugMode, currentPageId, resolvedTheme, baseElementId, displayBorderComponents, getWindow, rootRef]
  );

  const baseElementValueMemo = useMemo(() => ({ id: baseElementId, rootId: baseElementId }), [baseElementId]);

  return (
    <div
      className={clsx(
        'builder-area flex flex-col select-none',
        {
          'min-w-150 overflow-hidden': multiPagesMode,
          'basis-0 overflow-auto': !multiPagesMode && !mobilePreview,
          grow: !mobilePreview && !mobilePreview,
          'px-4 pt-4 pb-2': mode === 'normal',
          'p-2': mode !== 'normal',
          'max-w-360': displayMode === 'desktop',
          'max-w-3xl': displayMode === 'tablet',
          'max-w-106.25': displayMode === 'mobile'
        },
        className
      )}
    >
      <div className="mx-auto mb-2 flex w-full grow basis-0 flex-col shadow">
        {mode === 'normal' && showHeader && (
          <BuilderAreaHeader
            themeArea={themeArea}
            setThemeArea={setThemeArea}
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
            id={`i-builder-${baseElementId}`}
            // zoom={zoom}
            css={css}
            assets={assets}
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
                  <SpaceContainer>
                    <PlitziServiceProvider value={plitziContextValue}>
                      <HelmetProvider>
                        <Plugin key={baseElementId} internalProps={baseElementValueMemo} />
                      </HelmetProvider>
                    </PlitziServiceProvider>
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
                        title={`${collaborator.user.firstName} ${collaborator.user.surName}`}
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
