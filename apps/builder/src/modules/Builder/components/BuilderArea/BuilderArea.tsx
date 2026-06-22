import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { memo, useCallback, use, useMemo, useRef, useState } from 'react';

import { PlitziServiceProvider } from '@plitzi/sdk-elements/Element/PlitziServiceProvider';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import processCssTokens from '@plitzi/sdk-style/helpers/processCssTokens';
import { schemaVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';
import AppContext from '@pmodules/App/AppContext';
import BuilderContextMenu from '@pmodules/Builder/components/BuilderContextMenu';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import SpaceContainer from '@pmodules/Space/SpaceContainer';

import BuilderAreaHeader from './BuilderAreaHeader';
import BuilderAreaOverlay from './BuilderAreaOverlay';
import BuilderAreaTracking from './BuilderAreaTracking';
// eslint-disable-next-line
// @ts-ignore
import styleFrame from '../../Assets/index-iframe.scss?inline';
import BuilderCollaboratorArea from '../BuilderCollaborator/BuilderCollaboratorArea';

import type { ComponentPluginWithHOC, DisplayMode } from '@plitzi/sdk-shared';

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
    theme,
    multiPagesMode,
    mode,
    baseContext: { baseElementId },
    builderGetBaseElement
  } = use(BuilderContext);
  const { displayBorderComponents, zoom } = use(AppContext);
  const css = useMemo(() => {
    const cssVariables = schemaVariablesToCss(variables as Record<string, string>);
    const cacheParsed = processCssTokens(cache, variables as Record<string, string>);

    return `:root{${cssVariables}}\n${styleFrame}\n@layer plitzi-builder-runtime{${cacheParsed}\n${customCss}\n${externalStyle}}`;
  }, [customCss, cache, externalStyle, variables]);
  const [iframeActive, setIframeActive] = useState(!multiPagesMode);
  const ref = useRef<HTMLIFrameElement>(null);
  const refContainer = useRef<HTMLDivElement>(null);
  const { supportRealTime, subscriptionsCollaborators } = use(BuilderSubscriptionsContext);
  const { currentPageId } = use(NavigationContext);
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
        theme
      },
      root: { baseElementId },
      utils: { displayBorderComponents, getWindow, rootRef },
      customContexts: {},
      contexts: {
        ComponentContext,
        ContainerRootContext,
        SegmentsContext,
        CollectionContext,
        NetworkContext,
        PluginsContext,
        NavigationContext,
        InteractionsContext,
        EventBridgeContext,
        BuilderContext
      }
    }),
    [previewMode, debugMode, currentPageId, theme, baseElementId, displayBorderComponents, getWindow, rootRef]
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
            style={{ colorScheme: theme === 'system' ? 'light' : theme }}
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
                      <Plugin key={baseElementId} internalProps={baseElementValueMemo} />
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
                    subscriptionsCollaborators.map((subscriptionsCollaborator, i) => (
                      <BuilderCollaboratorArea
                        key={i}
                        trackingContainerRef={trackingContainerRef}
                        refIframe={ref}
                        baseElementId={baseElementId}
                        color={subscriptionsCollaborator.color}
                        title={`${subscriptionsCollaborator.user.firstName} ${subscriptionsCollaborator.user.surName}`}
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
