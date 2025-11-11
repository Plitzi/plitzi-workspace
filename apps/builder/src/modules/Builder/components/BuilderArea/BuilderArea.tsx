import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import classNames from 'classnames';
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import { memo, useCallback, use, useEffect, useMemo, useRef, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import processCssVariables from '@plitzi/sdk-style/helpers/processCssVariables';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import { variablesToCss } from '@plitzi/sdk-variables/VariablesHelper';
import AppContext from '@pmodules/App/AppContext';
import BuilderContextMenu from '@pmodules/Builder/components/BuilderContextMenu';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import SpaceContainer from '@pmodules/Space/SpaceContainer';

import BuilderAreaFooter from './BuilderAreaFooter';
import BuilderAreaHeader from './BuilderAreaHeader';
import BuilderAreaOverlay from './BuilderAreaOverlay';
import BuilderAreaTracking from './BuilderAreaTracking';
import styleFrame from '../../Assets/index-iframe.scss?inline';
import BuilderCollaboratorArea from '../BuilderCollaborator/BuilderCollaboratorArea';

import type { ComponentPlugin, DisplayMode } from '@plitzi/sdk-shared';

export type BuilderAreaProps = {
  className?: string;
  customCss?: string;
  externalStyle?: string;
  displayMode?: DisplayMode;
  showHeader?: boolean;
  headerTitle?: string;
  showFooter?: boolean;
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
  showFooter = true,
  mobilePreview = false,
  previewMode = false,
  debugMode = false
}: BuilderAreaProps) => {
  const { assets } = use(PluginsContext);
  const {
    multiPagesMode,
    mode,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const { displayBorderComponents, zoom } = use(AppContext);
  const {
    style,
    style: { cache }
  } = use(BuilderStyleContext);
  const { useDataSource } = use(DataSourceContext);
  // @todo: variables should be only related to styles
  const { variables } = useDataSource<Record<string, string>>({ id: '', mode: 'read' });
  const css = useMemo(() => {
    const cssVariables = variablesToCss(variables);
    const cacheParsed = processCssVariables(cache, variables);

    return `:root{${cssVariables}}\n${styleFrame}\n${cacheParsed}\n${customCss}\n${externalStyle}`;
  }, [customCss, cache, externalStyle, variables]);
  const [iframeActive, setIframeActive] = useState(!multiPagesMode);
  const [dragTree, setDragTreeState] = useState(false);
  const ref = useRef<HTMLIFrameElement>(null);
  const refContainer = useRef<HTMLDivElement>(null);
  const [iframeScaleX, setIframeScaleX] = useState(1);
  const [desiredWidth] = useState(1440);
  const { supportRealTime, subscriptionsCollaborators } = use(BuilderSubscriptionsContext);
  const { currentPageId } = use(NavigationContext);
  const { schema, builderGetBaseElement } = use(BuilderSchemaContext);
  const { rootDOM } = use(ContainerRootContext);

  const callbackRefresh = useCallback(() => {
    if (!refContainer.current || !ref.current) {
      return;
    }

    let newDesiredWidth = desiredWidth;
    switch (displayMode) {
      case 'desktop':
        newDesiredWidth = 1440;

        break;

      case 'tablet':
        newDesiredWidth = 768;

        break;

      case 'mobile':
        newDesiredWidth = 425;

        break;

      default:
        break;
    }

    const elementDOM = refContainer.current;
    const widthArea = elementDOM.offsetWidth;
    let iframeScaleX = widthArea / newDesiredWidth > 1 || widthArea === 0 ? 1 : widthArea / newDesiredWidth;
    if (!multiPagesMode) {
      iframeScaleX = 1;
    }

    ref.current.style.width = `${(1 / iframeScaleX) * 100}%`;
    ref.current.style.height = `${(1 / iframeScaleX) * 100}%`;
    ref.current.style.transform = `scale(${iframeScaleX})`;
    setIframeScaleX(iframeScaleX);
  }, [displayMode, desiredWidth, multiPagesMode]);

  const callbackRefreshDebounced = useMemo(() => debounce(callbackRefresh, 50), [callbackRefresh]);

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

  useEffect(() => {
    let observer: ResizeObserver | undefined;
    if (refContainer.current) {
      observer = new window.ResizeObserver(callbackRefreshDebounced);
      observer.observe(refContainer.current);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }

      callbackRefreshDebounced.cancel();
    };
  }, [callbackRefreshDebounced]);

  const setDragTree = useCallback((newDragTree: boolean) => setDragTreeState(newDragTree), []);

  const baseElement = builderGetBaseElement(baseElementId);
  const baseElementData = get(baseElement, 'data');
  const Plugin = get(baseElement, 'Plugin') as ComponentPlugin | undefined;

  const plitziContextValue = useMemo(
    () => ({
      settings: { previewMode, debugMode, currentPageId, environment: 'main' },
      root: { baseElementId },
      utils: { displayBorderComponents, getWindow, rootDOM },
      customContexts: {},
      contexts: {
        ComponentContext,
        ContainerRootContext,
        SchemaContext,
        StyleContext,
        SegmentsContext,
        CollectionContext,
        NetworkContext,
        PluginsContext,
        NavigationContext,
        DataSourceContext,
        StateManagerContext,
        InteractionsContext,
        EventBridgeContext,
        BuilderContext
      }
    }),
    [previewMode, debugMode, currentPageId, baseElementId, displayBorderComponents, getWindow, rootDOM]
  );

  const schemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const styleValueMemo = useMemo(() => ({ style }), [style]);
  const baseElementValueMemo = useMemo(() => ({ id: baseElementId, rootId: baseElementId }), [baseElementId]);

  return (
    <div
      className={classNames(
        'builder-area flex flex-col p-2 select-none',
        {
          'min-w-[600px] overflow-hidden': multiPagesMode,
          'basis-0 overflow-auto': !multiPagesMode,
          grow: !mobilePreview && !mobilePreview,
          'px-4 pt-4 pb-2': mode === 'normal',
          'p-2': mode !== 'normal'
        },
        className
      )}
    >
      <div
        className={classNames('mx-auto mb-2 flex w-full grow basis-0 flex-col shadow', {
          'max-w-[1440px]': displayMode === 'desktop',
          'max-w-3xl': displayMode === 'tablet',
          'max-w-[425px]': displayMode === 'mobile'
        })}
      >
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
            zoom={zoom}
            css={css}
            assets={assets}
            className="absolute h-full w-full origin-top-left"
          >
            {Plugin && (
              <>
                <BuilderAreaTracking
                  iframeScaleX={iframeScaleX}
                  className="builder-iframe"
                  isActive={iframeActive}
                  iframeDOM={ref.current}
                  previewMode={previewMode}
                >
                  <SpaceContainer>
                    <PlitziServiceProvider value={plitziContextValue}>
                      <SchemaContext value={schemaValueMemo}>
                        <StyleContext value={styleValueMemo}>
                          <Plugin key={baseElementId} internalProps={baseElementValueMemo} />
                        </StyleContext>
                      </SchemaContext>
                    </PlitziServiceProvider>
                  </SpaceContainer>

                  {!previewMode && (
                    <BuilderAreaOverlay
                      baseElementId={baseElementId}
                      refIframe={ref}
                      dragTree={dragTree}
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
                        scale={iframeScaleX}
                        refIframe={ref}
                        baseElementId={baseElementId}
                        instanceId={subscriptionsCollaborator.instanceId}
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
      {!multiPagesMode && mode === 'normal' && showFooter && <BuilderAreaFooter setDragTree={setDragTree} />}
    </div>
  );
};

export default memo(BuilderArea);
