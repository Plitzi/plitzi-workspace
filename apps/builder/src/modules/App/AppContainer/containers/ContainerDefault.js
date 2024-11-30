// Packages
import React, { useCallback, use, useMemo } from 'react';
import PopupSidebar from '@plitzi/plitzi-ui-components/Popup/PopupSidebar';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Alias
import Builder from '@pmodules/Builder';
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
  const { pages, settings } = use(SchemaMainContext);
  const [state, setCache, getCacheByKey] = useCache();
  const popupsActive = useMemo(
    () => getCacheByKey('PopupSidebar.popupsActive', { left: [], right: [] }),
    [state, getCacheByKey]
  );

  const handleClickSelectLeft = useCallback(
    (popupId, popups) => setCache(popups, 'PopupSidebar.popupsActive.left'),
    [setCache]
  );

  const handleClickSelectRight = useCallback(
    (popupId, popups) => setCache(popups, 'PopupSidebar.popupsActive.right'),
    [setCache]
  );

  const handleLoadPopupsLeft = useCallback(popups => setCache(popups, 'PopupSidebar.popupsActive.left'), [setCache]);

  const handleLoadPopupsRight = useCallback(popups => setCache(popups, 'PopupSidebar.popupsActive.right'), [setCache]);

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
      {!previewMode && (
        <PopupSidebar
          className="overflow-y-auto max-h-[calc(_100vh_-_48px)]"
          placementTabs="left"
          placement="left"
          minWidth={335}
          maxWidth={540}
          canHide
          multiSelect
          popupsActive={popupsActive.left}
          onSelect={handleClickSelectLeft}
          onLoadPopups={handleLoadPopupsLeft}
        />
      )}
      <Builder externalStyle={externalStyle} customCss={customCss} pages={pages} />

      {!previewMode && (
        <PopupSidebar
          className="overflow-y-auto max-h-[calc(_100vh_-_48px)]"
          placementTabs="right"
          placement="right"
          minWidth={335}
          maxWidth={540}
          canHide
          multiSelect
          popupsActive={popupsActive.right}
          onSelect={handleClickSelectRight}
          onLoadPopups={handleLoadPopupsRight}
        />
      )}
    </div>
  );
};

export default ContainerDefault;
