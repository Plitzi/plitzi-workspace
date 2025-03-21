import Flex from '@plitzi/plitzi-ui/Flex';

import InspectorLabel from '../InspectorLabel';
import OptionIconGroup from './categoryTypes/OptionIconGroup';
import OptionInput from './categoryTypes/OptionInput';
import OptionMetricInput from './categoryTypes/OptionMetricInput';

import type { OptionIconGroupProps } from './categoryTypes/OptionIconGroup';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CategoryOptionType = 'input' | 'select' | 'iconGroup';

type CategoryOptionPropsBase = {
  direction?: 'column' | 'row';
  keys?: StyleCategory[];
  label?: ReactNode;
  onChange?: (value: StyleValue | boolean) => void;
};

export type CategoryOptionProps =
  | (CategoryOptionPropsBase & { type: 'iconGroup'; items: OptionIconGroupProps['items'] })
  | (CategoryOptionPropsBase & { type?: 'input' | 'select' | 'metric'; value?: StyleValue });

const isIconGroup = (props: CategoryOptionProps): props is CategoryOptionProps & { type: 'iconGroup' } =>
  props.type === 'iconGroup';

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
        {isIconGroup(props) && <OptionIconGroup {...extraProps} />}
        {type === 'input' && <OptionInput {...extraProps} />}
        {props.type === 'metric' && <OptionMetricInput {...extraProps} />}
      </>
    </Flex>
  );
};

export default CategoryOption;
