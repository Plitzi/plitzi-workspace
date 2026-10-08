import clsx from 'clsx';
import { memo, use, useCallback } from 'react';

import { labelHint, labelSource } from './helpers';
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
  const { resetValue, inheritData } = use(StyleInspectorContext);
  const flags = useInspectorValues({ keys: keyValue, asValue: false });
  const { hasValues } = flags;
  const source = labelSource(flags);
  const hint = labelHint(source, hasValues, keyValue, inheritData);

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
      title={hint ?? (typeof children === 'string' ? children : undefined)}
    >
      <label
        className={clsx('m-0 truncate rounded-sm leading-5 transition-colors duration-150', {
          'px-1': !sectionTitle,
          'rounded-b-none border border-gray-300 bg-gray-100 px-2 font-semibold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200':
            sectionTitle,
          'text-zinc-600 dark:text-zinc-400': !sectionTitle && source === 'none',
          // Where a value comes from is told by a tint, not a block of colour: a panel where half the rows inherit
          // something reads as calm, and the rows set on this selector are the ones that stand out.
          'bg-sky-500/12 text-sky-700 dark:bg-sky-400/12 dark:text-sky-300': source === 'value',
          'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300': source === 'variable',
          'bg-violet-500/12 text-violet-700 dark:bg-violet-400/14 dark:text-violet-300': source === 'binding',
          'text-amber-700 dark:text-amber-400/90': source === 'inherit',
          'cursor-pointer hover:bg-red-500/12 hover:text-red-700 hover:line-through dark:hover:bg-red-400/12 dark:hover:text-red-300':
            hasValues
        })}
        onClick={handleClickResetValue}
      >
        {children}
      </label>
    </div>
  );
};

export default memo(InspectorLabel);
