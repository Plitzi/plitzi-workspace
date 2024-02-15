// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import PopupSidebar from '@plitzi/plitzi-ui-components/Popup/PopupSidebar';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';
import PopupProvider from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

// Monorepo
import EventBridgeContext from '@repo/event-bridge/EventBridgeContext';
import { EventBridgeModuleTypes } from '@repo/event-bridge/EventBridgeHelper';

// Alias
import Builder from '@pmodules/Builder';
import BuilderProvider from '@pmodules/Builder/BuilderProvider';
import StyleContext from '@pmodules/Style/StyleContext';
import SchemaContext from '@pmodules/Schema/SchemaContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import NavigationContext from '@pmodules/Navigation/NavigationContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

const ContainerDefault = props => {
  const { previewMode = false, externalStyle = '' } = props;
  const { eventBridge } = useContext(EventBridgeContext);
  const schemaContext = useContext(SchemaContext);
  const { pages, settings } = useContext(SchemaMainContext);
  const styleContext = useContext(StyleContext);
  const { currentPageId } = useContext(NavigationContext);
  const [state, setCache, getCacheByKey] = useCache();
  const popupsActive = useMemo(() => getCacheByKey('PopupSidebar.popupsActive', []), [state]);

  const handleClickSelect = useCallback((popupId, popups) => setCache(popups, 'PopupSidebar.popupsActive'), []);

  const handleLoadPopups = useCallback(popups => setCache(popups, 'PopupSidebar.popupsActive'), []);

  const builderHandler = useCallback(
    (event, data) => eventBridge.emit(EventBridgeModuleTypes.MAIN, event, ...data),
    [eventBridge]
  );

  const { segments } = useContext(SegmentsContext);

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

ContainerDefault.propTypes = {
  previewMode: PropTypes.bool,
  externalStyle: PropTypes.string
};

export default ContainerDefault;
