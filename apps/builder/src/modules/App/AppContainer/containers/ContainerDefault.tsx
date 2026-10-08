import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupSidePanel } from '@plitzi/plitzi-ui/Popup';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Builder from '@pmodules/Builder';
import { useOpenComponent } from '@pmodules/Components';
import ComponentBanner from '@pmodules/Components/components/ComponentBanner';

/** Room for the style inspector's controls side by side without a label cut; the person widens it from there. */
const RIGHT_PANEL_WIDTH = 380;

export type ContainerDefaultProps = {
  previewMode?: boolean;
  externalStyle?: string;
};

const ContainerDefault = ({ previewMode = false, externalStyle = '' }: ContainerDefaultProps) => {
  const [[storedCss, pages]] = useBuilderStore(['schema.settings.customCss', 'schema.pages']);
  const customCss = typeof storedCss === 'string' ? storedCss : '';
  const { component } = useOpenComponent();
  const [width, setWidth] = useStorage('builder-state.popupSidePanel.width.right', RIGHT_PANEL_WIDTH);

  return (
    <div className="flex w-full grow">
      <div className="flex grow basis-0 flex-col">
        {component && !previewMode && <ComponentBanner component={component} />}
        <Builder externalStyle={externalStyle} customCss={customCss} pages={pages} />
      </div>
      {!previewMode && (
        <PopupSidePanel
          className="max-h-[calc(100vh-48px)] overflow-y-auto"
          size="md"
          placementTabs="right"
          placement="right"
          minWidth={320}
          maxWidth={800}
          width={width}
          canHide
          onResize={setWidth}
        />
      )}
    </div>
  );
};

export default ContainerDefault;
