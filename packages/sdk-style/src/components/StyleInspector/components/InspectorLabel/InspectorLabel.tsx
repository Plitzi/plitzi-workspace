import classNames from 'classnames';
import { memo, use, useCallback } from 'react';

import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

export type InspectorLabelProps = {
  className?: string;
  children?: React.ReactNode;
  keyValue?: string[];
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
      className={classNames('inspector__label flex items-center min-w-[50px] select-none shrink-0', className, {
        'text-xs': size === 'small',
        'text-sm': size === 'medium',
        'text-base': size === 'normal',
        'p-0.5': !sectionTitle,
        'mb-[-1px] p-0': sectionTitle
      })}
      title={typeof children === 'string' ? children : undefined}
    >
      <label
        className={classNames('m-0 truncate', {
          'px-1': !sectionTitle,
          'px-2 border rounded-tr rounded-tl bg-gray-100 border-gray-300 font-bold': sectionTitle,
          'text-blue-400 bg-blue-200 cursor-pointer': hasValues && !hasBinding && !hasVariables,
          'text-green-400 bg-green-200 cursor-pointer': hasVariables,
          'text-purple-400 bg-purple-200 cursor-pointer': hasBinding,
          'text-orange-400 bg-orange-200 cursor-pointer': hasInherit && !hasValues && !hasVariables
        })}
        onClick={handleClickResetValue}
      >
        {children}
      </label>
    </div>
  );
};

export default memo(InspectorLabel);
