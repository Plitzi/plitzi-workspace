import Flex from '@plitzi/plitzi-ui/Flex';

import InspectorLabel from '../InspectorLabel';

import type { StyleCategory } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CategoryOptionType = 'text' | 'select' | 'iconGroup';

export type CategoryOptionProps = {
  children?: ReactNode;
  label?: ReactNode;
  direction?: 'column' | 'row';
  keys?: StyleCategory[];
};

const CategorySection = ({ children, direction = 'row', label, keys }: CategoryOptionProps) => {
  return (
    <Flex
      direction={direction}
      gap={2}
      justify={direction === 'row' ? 'between' : undefined}
      items={direction === 'row' ? 'center' : undefined}
    >
      {label && (
        <InspectorLabel className="w-16" keyValue={keys}>
          {label}
        </InspectorLabel>
      )}
      {children}
    </Flex>
  );
};

export default CategorySection;
