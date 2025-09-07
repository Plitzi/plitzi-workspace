import classNames from 'classnames';
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
      className={classNames('inspector__label flex min-w-[50px] shrink-0 items-center select-none', className, {
        'text-xs': size === 'small',
        'text-sm': size === 'medium',
        'text-base': size === 'normal',
        'mb-[-1px] p-0': sectionTitle
      })}
      title={typeof children === 'string' ? children : undefined}
    >
      <label
        className={classNames('m-0 truncate', {
          'px-1': !sectionTitle,
          'rounded-tl rounded-tr border border-gray-300 bg-gray-100 px-2 font-bold': sectionTitle,
          'cursor-pointer bg-blue-200 text-blue-400': hasValues && !hasBinding && !hasVariables,
          'cursor-pointer bg-green-200 text-green-400': hasVariables,
          'cursor-pointer bg-purple-200 text-purple-400': hasBinding,
          'cursor-pointer bg-orange-200 text-orange-400': hasInherit && !hasValues && !hasVariables
        })}
        onClick={handleClickResetValue}
      >
        {children}
      </label>
    </div>
  );
};

export default memo(InspectorLabel);
