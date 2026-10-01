import { PopupSidePanel } from '@plitzi/plitzi-ui/Popup';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Builder from '@pmodules/Builder';
import { useOpenComponent } from '@pmodules/Components';
import ComponentBanner from '@pmodules/Components/components/ComponentBanner';

export type ContainerDefaultProps = {
  previewMode?: boolean;
  externalStyle?: string;
};

const ContainerDefault = ({ previewMode = false, externalStyle = '' }: ContainerDefaultProps) => {
  const [[storedCss, pages]] = useBuilderStore(['schema.settings.customCss', 'schema.pages']);
  const customCss = typeof storedCss === 'string' ? storedCss : '';
  const { component } = useOpenComponent();

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
          minWidth={335}
          maxWidth={800}
          canHide
        />
      )}
    </div>
  );
};

export default ContainerDefault;
