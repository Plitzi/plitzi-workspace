// Packages
import React from 'react';
import noop from 'lodash/noop';
import InputMetric from '@plitzi/plitzi-ui-components/InputMetric';

// Monorepo
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

// Alias
import Icons from '@pcomponents/Icons';
import InspectorButton from '@pmodules/Style/components/InspectorButton';

const iconsMap = {
  [MARGIN_TOP]: 'MarginTop',
  [MARGIN_BOTTOM]: 'MarginBottom',
  [MARGIN_LEFT]: 'MarginLeft',
  [MARGIN_RIGHT]: 'MarginRight',
  [PADDING_TOP]: 'PaddingTop',
  [PADDING_BOTTOM]: 'PaddingBottom',
  [PADDING_LEFT]: 'PaddingLeft',
  [PADDING_RIGHT]: 'PaddingRight'
};

/**
 * @param {{
 *   fragmentSelected: string;
 *   value: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SpacingEditor = props => {
  const { fragmentSelected, value, onChange = noop } = props;

  const handleClick = partialValue => () => {
    onChange(fragmentSelected, partialValue);
  };

  const handleChange = partialValue => {
    onChange(fragmentSelected, partialValue);
  };

  const segment = fragmentSelected.split('-')[0];

  return (
    <div className="bg-white mt-2 border border-gray-300 rounded-sm select-none">
      <div className="px-1 pt-1 grid grid-cols-2 gap-2 items-center">
        <div className="flex items-center capitalize mr-1">
          <Icons className="mr-1" type={iconsMap[fragmentSelected]} />
          <div className="text-xs truncate">{fragmentSelected.split('-').join(' ')}</div>
        </div>
        <InputMetric value={value} size="sm" onChange={handleChange} className="rounded-sm" />
      </div>
      <div className="flex">
        {segment === 'margin' && (
          <InspectorButton
            className="border border-gray-300 rounded-sm p-1 text-xs w-14 grow m-1"
            onClick={handleClick('auto')}
          >
            Auto
          </InspectorButton>
        )}
        <div className="grid grid-cols-4 grid-rows-2 gap-2 w-full m-1">
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('0px')}>
            0
          </InspectorButton>
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('10px')}>
            10
          </InspectorButton>
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('20px')}>
            20
          </InspectorButton>
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('40px')}>
            40
          </InspectorButton>
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('60px')}>
            60
          </InspectorButton>
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('100px')}>
            100
          </InspectorButton>
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('140px')}>
            140
          </InspectorButton>
          <InspectorButton className="border border-gray-300 rounded-sm p-0.5 text-xs" onClick={handleClick('220px')}>
            220
          </InspectorButton>
        </div>
      </div>
    </div>
  );
};

export default SpacingEditor;
