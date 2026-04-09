import clsx from 'clsx';
import { memo, use, useCallback } from 'react';

import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type InspectorLabelProps = {
  className?: string;
  children?: ReactNode;
  keyValue?: StyleCategory[];
  size?: 'small' | 'medium' | 'normal' | 'custom';
  sectionTitle?: boolean;
};

const InspectorLabel = ({
  keyValue,
  children,
  className = '',
  size = 'small',
  sectionTitle = false
}: InspectorLabelProps) => {
  const { resetValue } = use(StyleInspectorContext);
  const { hasValues, hasInherit, hasBinding, hasVariables } = useInspectorValues({
    keys: keyValue,
    asValue: false
  });

  const handleClickResetValue = useCallback(() => {
    if (!hasValues || !keyValue) {
      return;
    }

    resetValue(keyValue);
  }, [resetValue, hasValues, keyValue]);

  return (
    <div
      className={clsx('inspector__label flex min-w-[50px] shrink-0 items-center select-none', className, {
        'text-xs': size === 'small',
        'text-sm': size === 'medium',
        'text-base': size === 'normal',
        'mb-[-1px] p-0': sectionTitle
      })}
      title={typeof children === 'string' ? children : undefined}
    >
      <label
        className={clsx('m-0 truncate', {
          'px-1': !sectionTitle,
          'rounded-tl rounded-tr border border-gray-300 dark:border-zinc-600 bg-gray-100 dark:bg-zinc-700 px-2 font-bold text-zinc-700 dark:text-zinc-200': sectionTitle,
          'cursor-pointer bg-blue-200 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400': hasValues && !hasBinding && !hasVariables,
          'cursor-pointer bg-green-200 dark:bg-green-900/50 text-green-600 dark:text-green-400': hasVariables,
          'cursor-pointer bg-purple-200 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400': hasBinding,
          'bg-orange-200 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400': hasInherit && !hasValues && !hasVariables
        })}
        onClick={handleClickResetValue}
      >
        {children}
      </label>
    </div>
  );
};

export default memo(InspectorLabel);
