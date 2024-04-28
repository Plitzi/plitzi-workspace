// Packages
import React, { useCallback, use, useMemo } from 'react';
import PopupSidebar from '@plitzi/plitzi-ui-components/Popup/PopupSidebar';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';
import PopupProvider from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import Builder from '@pmodules/Builder';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

/**
 * @param {{
 *   previewMode?: boolean;
 *   externalStyle?: string;
 * }} props
 * @returns {React.ReactElement}
 */

const ContainerDefault = props => {
  const { previewMode = false, externalStyle = '' } = props;
  const { eventBridge } = use(EventBridgeContext);
  const schemaContext = use(SchemaContext);
  const { pages, settings } = use(SchemaMainContext);
  const styleContext = use(StyleContext);
  const { currentPageId } = use(NavigationContext);
  const [state, setCache, getCacheByKey] = useCache();
  const popupsActive = useMemo(() => getCacheByKey('PopupSidebar.popupsActive', []), [state]);

  const handleClickSelect = useCallback((popupId, popups) => setCache(popups, 'PopupSidebar.popupsActive'), []);

  const handleLoadPopups = useCallback(popups => setCache(popups, 'PopupSidebar.popupsActive'), []);

  const builderHandler = useCallback(
    (event, data) => eventBridge.emit(EventBridgeModuleTypes.MAIN, event, ...data),
    [eventBridge]
  );

  const { segments } = use(SegmentsContext);

  const customCss = useMemo(() => {
    let css = settings?.customCss ?? '';
    if (typeof css !== 'string') {
      css = '';
    }

    return [css, ...Object.values(segments).map(symbol => symbol.style.cache)].join('\n');
  }, [settings?.customCss, segments]);

  return (
    <div className="flex w-full grow">
      <BuilderProvider
        schema={schemaContext.schema}
        style={styleContext.style}
        baseElementId={currentPageId}
        onHandler={builderHandler}
      >
        <PopupProvider renderRightPopup={false} renderFloatingPopup={!previewMode}>
          <Builder externalStyle={externalStyle} customCss={customCss} pages={pages} />

          {!previewMode && (
            <PopupSidebar
              className="overflow-y-auto max-h-[calc(_100vh_-_48px)]"
              placementTabs="right"
              minWidth={335}
              maxWidth={540}
              canHide
              multiSelect
              popupsActive={popupsActive}
              onSelect={handleClickSelect}
              onLoadPopups={handleLoadPopups}
            />
          )}
        </PopupProvider>
      </BuilderProvider>
    </div>
  );
};

export default ContainerDefault;
