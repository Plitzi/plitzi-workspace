import Flex from '@plitzi/plitzi-ui/Flex';
import clsx from 'clsx';
import { Children } from 'react';

import InspectorLabel from '../InspectorLabel';

import type { StyleCategory } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CategoryOptionType = 'text' | 'select' | 'iconGroup';

export type CategoryOptionProps = {
  className?: string;
  children?: ReactNode;
  label?: ReactNode;
  direction?: 'column' | 'row';
  keys?: StyleCategory[];
};

/** Past two controls a row runs out of width in the panel, and the labels inside it are what gets cut. */
const ROW_LIMIT = 2;

const CategorySection = ({ children, className, direction = 'row', label, keys }: CategoryOptionProps) => {
  const count = Children.toArray(children).length;

  if (direction === 'row' && count > ROW_LIMIT) {
    return (
      <div className={clsx('flex flex-col gap-1', className)}>
        {label && (
          <InspectorLabel className="w-full" keyValue={keys}>
            {label}
          </InspectorLabel>
        )}
        {/* As many columns as the panel's width holds, so a wider panel lays the same controls out in fewer rows. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] items-end gap-2">{children}</div>
      </div>
    );
  }

  return (
    <Flex
      direction={direction}
      gap={2}
      justify={label && direction === 'row' ? 'between' : undefined}
      items={direction === 'row' ? 'center' : undefined}
      className={className}
    >
      {label && (
        <InspectorLabel className={direction === 'row' ? 'w-20' : 'w-full'} keyValue={keys}>
          {label}
        </InspectorLabel>
      )}
      {children}
    </Flex>
  );
};

export default CategorySection;
