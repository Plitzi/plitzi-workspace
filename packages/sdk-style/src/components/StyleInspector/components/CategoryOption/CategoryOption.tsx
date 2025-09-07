import Flex from '@plitzi/plitzi-ui/Flex';

import InspectorLabel from '../InspectorLabel';
import OptionColor from './categoryTypes/OptionColor';
import OptionIconGroup from './categoryTypes/OptionIconGroup';
import OptionInput from './categoryTypes/OptionInput';
import OptionMetricInput from './categoryTypes/OptionMetricInput';
import OptionSelect from './categoryTypes/OptionSelect';

import type { OptionIconGroupProps } from './categoryTypes/OptionIconGroup';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CategoryOptionType = 'input' | 'select' | 'iconGroup';

type CategoryOptionPropsBase = {
  className?: string;
  direction?: 'column' | 'row';
  keys?: StyleCategory[];
  label?: ReactNode;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

export type CategoryOptionProps =
  | (CategoryOptionPropsBase & { type: 'iconGroup'; items: OptionIconGroupProps['items'] })
  | (CategoryOptionPropsBase & { type: 'select'; children?: ReactNode })
  | (CategoryOptionPropsBase & {
      type: 'metric';
      value?: StyleValue;
      preffix?: string;
      units?: { label: string; value: string }[];
      allowedWords?: string[];
      step?: number;
      min?: number;
      max?: number;
    })
  | (CategoryOptionPropsBase & { type: 'color'; value?: StyleValue })
  | (CategoryOptionPropsBase & { type?: 'input' | 'select'; value?: StyleValue });

const CategoryOption = (props: CategoryOptionProps) => {
  const { direction = 'column', label, keys, type = 'input', ...extraProps } = props;

  return (
    <Flex className="w-full min-w-0" direction={direction} gap={1}>
      {label && (
        <InspectorLabel className="!min-w-0" keyValue={keys}>
          {label}
        </InspectorLabel>
      )}
      <>
        {type === 'iconGroup' && <OptionIconGroup {...extraProps} />}
        {type === 'input' && <OptionInput {...extraProps} />}
        {type === 'select' && <OptionSelect {...extraProps} />}
        {type === 'color' && <OptionColor {...extraProps} />}
        {type === 'metric' && <OptionMetricInput {...extraProps} />}
      </>
    </Flex>
  );
};

export default CategoryOption;
