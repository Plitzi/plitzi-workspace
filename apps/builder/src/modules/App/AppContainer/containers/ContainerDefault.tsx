import { PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { use, useMemo } from 'react';

import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import Builder from '@pmodules/Builder';

export type ContainerDefaultProps = {
  previewMode?: boolean;
  externalStyle?: string;
};

const ContainerDefault = ({ previewMode = false, externalStyle = '' }: ContainerDefaultProps) => {
  const { pages, settings } = use(SchemaMainContext);
  const { segments } = use(SegmentsContext);
  const customCss = useMemo(() => {
    let css = settings.customCss;
    if (typeof css !== 'string') {
      css = '';
    }

    return [css, ...Object.values(segments).map(symbol => symbol.style.cache)].join('\n');
  }, [settings.customCss, segments]);

  return (
    <div className="flex w-full grow">
      <Builder externalStyle={externalStyle} customCss={customCss} pages={pages} />
      {!previewMode && (
        <PopupSidePanel
          className="max-h-[calc(100vh-48px)] overflow-y-auto"
          size="md"
          placementTabs="right"
          placement="right"
          minWidth={335}
          maxWidth={800}
          canHide
          multi
        />
      )}
    </div>
  );
};

export default ContainerDefault;
