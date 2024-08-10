// Packages
import React, { memo, useCallback, use, useEffect, useMemo, useRef, useState } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import debounce from 'lodash/debounce';
import { ComponentContext, PlitziServiceProvider } from '@plitzi/plitzi-sdk';
import ContainerFrame from '@plitzi/plitzi-ui-components/ContainerFrame';
import ContainerShadow from '@plitzi/plitzi-ui-components/ContainerShadow';
import ContainerRootContext from '@plitzi/plitzi-ui-components/ContainerRoot/ContainerRootContext';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';

// Alias
import BuilderContextMenu from '@pmodules/Builder/components/BuilderContextMenu';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';
import CollectionContext from '@pmodules/Collection/CollectionContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';
import SpaceContainer from '@pmodules/Space/SpaceContainer';

// Relatives
import BuilderAreaHeader from './BuilderAreaHeader';
import BuilderAreaFooter from './BuilderAreaFooter';
import BuilderCollaboratorArea from '../BuilderCollaborator/BuilderCollaboratorArea';
import BuilderAreaTracking from './BuilderAreaTracking';
import BuilderAreaOverlay from './BuilderAreaOverlay';
import { BUILDER_MODE_NORMAL } from '../../BuilderProvider';

// Style
import styleFrame from '!!css-loader!postcss-loader!sass-loader!../../Assets/index-iframe.scss'; // eslint-disable-line
import styleTailwind from '!!css-loader!postcss-loader!sass-loader!../../Assets/index-iframe-tailwind.scss'; // eslint-disable-line

// SDK Style
import sdkStyle from '!css-loader!postcss-loader!@plitzi/plitzi-sdk/plitzi-sdk.css'; // eslint-disable-line

/**
 * @param {{
 *   className?: string;
 *   customCss?: string;
 *   externalStyle?: string;
 *   displayMode?: 'desktop' | 'tablet' | 'mobile';
 *   showHeader?: boolean;
 *   headerTitle?: string;
 *   showFooter?: boolean;
 *   mobilePreview?: boolean;
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderArea = props => {
  const {
    className = '',
    customCss = '',
    externalStyle = '',
    displayMode = 'desktop',
    showHeader = true,
    headerTitle = '',
    showFooter = true,
    mobilePreview = false,
    previewMode = false
  } = props;
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
  const css = useMemo(
    () => `${sdkStyle[0][1]}\n${styleFrame[0][1]}\n${styleFrame[1][1]}\n${`${cache}\n${customCss}`}\n${externalStyle}`,
    [customCss, cache, externalStyle]
  );
  const [iframeActive, setIframeActive] = useState(!multiPagesMode);
  const [dragTree, setDragTreeState] = useState(false);
  const ref = useRef(null);
  const refContainer = useRef(null);
  const [widthArea, setWidthArea] = useState(0);
  const [heightArea, setHeightArea] = useState(0);
  const [iframeScaleX, setIframeScaleX] = useState(1);
  const [desiredWidth] = useState(1440);
  const { supportRealTime, subscriptionsCollaborators } = use(BuilderSubscriptionsContext);
  const { currentPageId } = use(NavigationContext);
  const { schema, builderGetBaseElement } = use(BuilderSchemaContext);
  const { rootDOM } = use(ContainerRootContext);

  const callbackRefresh = () => {
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
    setWidthArea(widthArea);
    setHeightArea(elementDOM.offsetHeight);
    setIframeScaleX(iframeScaleX);
  };

  const callbackRefreshDebounced = useMemo(() => debounce(callbackRefresh, 50), [displayMode]);

  const getWindow = useCallback(() => {
    if (ref.current) {
      return ref.current.contentWindow;
    }

    if (typeof window !== 'undefined') {
      return window;
    }

    // @todo: Hmm what to put here
    return { innerWidth: 1440, innerHeight: 900 };
  }, [ref]);

  useEffect(() => {
    let observer;
    if (refContainer.current) {
      const observer = new window.ResizeObserver(callbackRefreshDebounced);
      observer.observe(refContainer.current);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }

      if (callbackRefreshDebounced) {
        callbackRefreshDebounced.cancel();
      }
    };
  }, [callbackRefreshDebounced]);

  const setDragTree = useCallback(newDragTree => {
    if (dragTree !== newDragTree) {
      setDragTreeState(newDragTree);
    }
  }, []);

  const handleDragOver = useCallback(() => {
    if (dragTree) {
      setDragTreeState(false);
    }
  }, [setDragTreeState, dragTree]);

  const baseElement = builderGetBaseElement(baseElementId);
  const baseElementData = get(baseElement, 'data');
  const Plugin = get(baseElement, 'Plugin');

  const plitziContextValue = useMemo(
    () => ({
      settings: { previewMode, currentPageId, environment: 'main' },
      root: { baseElementId },
      utils: { displayBorderComponents, getWindow, rootDOM },
      customContexts: {},
      contexts: {
        ComponentContext,
        ContainerRootContext,
        SchemaContext,
        SegmentsContext,
        CollectionContext,
        NetworkContext,
        PluginsContext,
        NavigationContext,
        DataSourceContext,
        StateManagerContext,
        InteractionsContext,
        EventBridgeContext
      }
    }),
    [
      PluginsContext,
      DataSourceContext,
      currentPageId,
      previewMode,
      baseElementId,
      ComponentContext,
      getWindow,
      displayBorderComponents,
      SchemaContext,
      SegmentsContext,
      CollectionContext,
      NavigationContext,
      NetworkContext,
      StateManagerContext,
      InteractionsContext,
      EventBridgeContext
    ]
  );

  const schemaValueMemo = useMemo(() => ({ schema }), [schema]);
  const styleValueMemo = useMemo(() => ({ style }), [style]);
  const baseElementValueMemo = useMemo(() => ({ id: baseElementId, rootId: baseElementId }), [baseElementId]);

  return (
    <div
      className={classNames(
        'builder-area p-2 flex flex-col select-none',
        {
          'overflow-hidden min-w-[600px]': multiPagesMode,
          'overflow-auto basis-0': !multiPagesMode,
          grow: !mobilePreview && !mobilePreview,
          'px-4 pt-4 pb-2': mode === BUILDER_MODE_NORMAL,
          'p-2': mode !== BUILDER_MODE_NORMAL
        },
        className
      )}
    >
      <div
        className={classNames('w-full mx-auto mb-2 flex flex-col grow basis-0 shadow', {
          'max-w-[1440px]': displayMode === 'desktop',
          'max-w-[768px]': displayMode === 'tablet',
          'max-w-[425px]': displayMode === 'mobile'
        })}
      >
        {mode === BUILDER_MODE_NORMAL && showHeader && (
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
          className="h-full w-full relative flex flex-col"
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
            className="w-full h-full absolute origin-top-left"
          >
            {Plugin && (
              <>
                <BuilderAreaTracking
                  onDragOver={handleDragOver}
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
                      iframeDOM={ref.current}
                      dragTree={dragTree}
                      displayMode={displayMode}
                      zoom={zoom}
                    />
                  )}
                  {supportRealTime &&
                    !previewMode &&
                    subscriptionsCollaborators.map((subscriptionsCollaborator, i) => (
                      <BuilderCollaboratorArea
                        key={i}
                        scale={iframeScaleX}
                        iframeDOM={ref.current}
                        baseElementId={baseElementId}
                        instanceId={subscriptionsCollaborator.instanceId}
                        color={subscriptionsCollaborator.color}
                        title={`${subscriptionsCollaborator.user.firstName} ${subscriptionsCollaborator.user.surName}`}
                        width={widthArea}
                        height={heightArea}
                        displayMode={displayMode}
                        zoom={zoom}
                      />
                    ))}
                </BuilderAreaTracking>
                <ContainerShadow>
                  {assets &&
                    Object.values(assets).map((asset, i) => (
                      <ContainerShadow.Link key={i} href={asset?.params?.href} />
                    ))}
                  <ContainerShadow.Content>
                    <style>{styleTailwind[0][1]}</style>
                    {!previewMode && iframeActive && (
                      <BuilderContextMenu iframeDOM={ref.current} getWindow={getWindow} zoom={zoom} />
                    )}
                  </ContainerShadow.Content>
                </ContainerShadow>
              </>
            )}
          </ContainerFrame>
        </div>
      </div>
      {!multiPagesMode && showFooter && <BuilderAreaFooter setDragTree={setDragTree} />}
    </div>
  );
};

export default memo(BuilderArea);
