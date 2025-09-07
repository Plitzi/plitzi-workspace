import Button from '@plitzi/plitzi-ui/Button';
import Icon from '@plitzi/plitzi-ui/Icon';
import MarginBottom from '@plitzi/plitzi-ui/icons/MarginBottom';
import MarginLeft from '@plitzi/plitzi-ui/icons/MarginLeft';
import MarginRight from '@plitzi/plitzi-ui/icons/MarginRight';
import MarginTop from '@plitzi/plitzi-ui/icons/MarginTop';
import PaddingBottom from '@plitzi/plitzi-ui/icons/PaddingBottom';
import PaddingLeft from '@plitzi/plitzi-ui/icons/PaddingLeft';
import PaddingRight from '@plitzi/plitzi-ui/icons/PaddingRight';
import PaddingTop from '@plitzi/plitzi-ui/icons/PaddingTop';
import MetricInput from '@plitzi/plitzi-ui/MetricInput';

import {
  MARGIN_TOP,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT
} from '@plitzi/sdk-shared/style/styleConstants';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

// import InspectorButton from '@pmodules/Style/components/InspectorButton';

const iconsMap = {
  [MARGIN_TOP]: <MarginTop />,
  [MARGIN_BOTTOM]: <MarginBottom />,
  [MARGIN_LEFT]: <MarginLeft />,
  [MARGIN_RIGHT]: <MarginRight />,
  [PADDING_TOP]: <PaddingTop />,
  [PADDING_BOTTOM]: <PaddingBottom />,
  [PADDING_LEFT]: <PaddingLeft />,
  [PADDING_RIGHT]: <PaddingRight />
} as const;

export type SpacingEditorProps = {
  fragmentSelected: StyleCategory;
  value?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const SpacingEditor = ({ fragmentSelected, value, onChange }: SpacingEditorProps) => {
  const handleClick = (partialValue: StyleValue) => () => {
    onChange?.(fragmentSelected, partialValue);
  };

  const handleChange = (partialValue: StyleValue) => {
    onChange?.(fragmentSelected, partialValue);
  };

  const segment = fragmentSelected.split('-')[0];

  return (
    <div className="mt-2 rounded-sm border border-gray-300 bg-white select-none">
      <div className="grid grid-cols-2 items-center gap-2 px-1 pt-1">
        <div className="mr-1 flex items-center capitalize">
          <Icon className="mr-1">{iconsMap[fragmentSelected as keyof typeof iconsMap]}</Icon>
          <div className="truncate text-xs">{fragmentSelected.split('-').join(' ')}</div>
        </div>
        <MetricInput value={value as string | undefined} size="sm" onChange={handleChange} className="rounded-sm" />
      </div>
      <div className="flex">
        {segment === 'margin' && (
          <Button intent="secondary" size="xs" className="m-1 w-14 grow" onClick={handleClick('auto')}>
            Auto
          </Button>
        )}
        <div className="m-1 grid w-full grid-cols-4 grid-rows-2 gap-2">
          <Button intent="secondary" size="xs" onClick={handleClick('0px')}>
            0
          </Button>
          <Button intent="secondary" size="xs" onClick={handleClick('10px')}>
            10
          </Button>
          <Button intent="secondary" size="xs" onClick={handleClick('20px')}>
            20
          </Button>
          <Button intent="secondary" size="xs" onClick={handleClick('40px')}>
            40
          </Button>
          <Button intent="secondary" size="xs" onClick={handleClick('60px')}>
            60
          </Button>
          <Button intent="secondary" size="xs" onClick={handleClick('100px')}>
            100
          </Button>
          <Button intent="secondary" size="xs" onClick={handleClick('140px')}>
            140
          </Button>
          <Button intent="secondary" size="xs" onClick={handleClick('220px')}>
            220
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SpacingEditor;
