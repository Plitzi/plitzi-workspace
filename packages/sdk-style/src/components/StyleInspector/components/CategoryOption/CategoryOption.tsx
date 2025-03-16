import Flex from '@plitzi/plitzi-ui/Flex';
// import { useCallback } from 'react';

import InspectorLabel from '../InspectorLabel';
import OptionIconGroup from './categoryTypes/OptionIconGroup';

import type { OptionIconGroupProps } from './categoryTypes/OptionIconGroup';
import type { StyleCategory } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CategoryOptionType = 'text' | 'select' | 'iconGroup';

type CategoryOptionPropsBase = {
  direction?: 'column' | 'row';
  keys?: StyleCategory[];
  label?: ReactNode;
  onChange?: (value: string) => void;
};

export type CategoryOptionProps =
  | (CategoryOptionPropsBase & { type: 'iconGroup'; items: OptionIconGroupProps['items'] })
  | (CategoryOptionPropsBase & { type?: 'text' | 'select' });

const isIconGroup = (props: CategoryOptionProps): props is CategoryOptionProps & { type: 'iconGroup' } =>
  props.type === 'iconGroup';

const CategoryOption = (props: CategoryOptionProps) => {
  const { direction = 'row', label, keys, type = 'text', ...extraProps } = props;

  return (
    <Flex direction={direction} gap={2} justify={direction === 'row' ? 'between' : undefined}>
      {label && (
        <InspectorLabel className="!min-w-0" keyValue={keys}>
          {label}
        </InspectorLabel>
      )}
      <div className="max-w-[210px] w-full">
        {isIconGroup(props) && <OptionIconGroup {...extraProps} />}
        {type === 'text' && <div>SAD</div>}
      </div>
    </Flex>
  );
};

export default CategoryOption;
