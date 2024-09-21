// Packages
import React, { memo, use, useCallback, useMemo } from 'react';
import classNames from 'classnames';

// Relatives
import StyleInspectorContext from './StyleInspectorContext';
import useInspectorValues from './hooks/useInspectorValues';

/**
 * @param {{
 *   className?: string;
 *   children?: React.ReactNode;
 *   keyValue?: string | string[];
 *   size?: 'small' | 'medium' | 'normal' | 'custom';
 *   sectionTitle?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const InspectorLabel = props => {
  const { keyValue, children, className = '', size = 'small', sectionTitle = false } = props;
  const { resetValue } = use(StyleInspectorContext);

  const keyValueMemo = useMemo(() => {
    if (keyValue && !Array.isArray(keyValue)) {
      return [keyValue];
    }

    return keyValue;
  }, [keyValue]);

  const { hasValues, hasInherit, hasBinding, hasVariables } = useInspectorValues({ keys: keyValueMemo });

  const handleClickResetValue = useCallback(() => {
    if (!hasValues) {
      return;
    }

    resetValue(keyValueMemo);
  }, [resetValue, hasValues, keyValueMemo]);

  return (
    <div
      className={classNames('inspector__label font-bold flex items-center min-w-[50px] select-none', className, {
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
          'text-green-400 bg-green-200 cursor-pointer': hasValues && hasVariables,
          'text-purple-400 bg-purple-200 cursor-pointer': hasBinding,
          'text-orange-400 bg-orange-200 cursor-pointer': hasInherit && !hasValues
        })}
        onClick={handleClickResetValue}
      >
        {children}
      </label>
    </div>
  );
};

export default memo(InspectorLabel);
