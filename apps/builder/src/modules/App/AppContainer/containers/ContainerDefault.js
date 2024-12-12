// Packages
import React, { useCallback, use, useMemo, useState } from 'react';
import PopupSidePanel from '@plitzi/plitzi-ui/Popup/PopupSidePanel';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Alias
import Builder from '@pmodules/Builder';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

const defaultCache = [];

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
  const [, setCache, getCacheByKey] = useCache();
  const [popupsActiveRight, setPopupsActiveRight] = useState(
    getCacheByKey('PopupSidePanel.popupsActive.right', defaultCache)
  );

  const handleChangeRight = useCallback(
    popups => {
      setCache(popups, 'PopupSidePanel.popupsActive.right');
      setPopupsActiveRight(popups);
    },
    [setCache]
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
      <Builder externalStyle={externalStyle} customCss={customCss} pages={pages} />
      {!previewMode && (
        <PopupSidePanel
          className="overflow-y-auto max-h-[calc(_100vh_-_48px)]"
          size="md"
          placementTabs="right"
          placement="right"
          minWidth={335}
          maxWidth={540}
          canHide
          multi
          value={popupsActiveRight}
          onChange={handleChangeRight}
        />
      )}
    </div>
  );
};

export default ContainerDefault;
