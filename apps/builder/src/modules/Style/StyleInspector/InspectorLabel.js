// Packages
import React, { memo, useContext, useMemo } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import isArray from 'lodash/isArray';

// Relatives
import StyleInspectorContext from './StyleInspectorContext';

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
  const { resetValue, bindingData, inheritData, hasValue } = useContext(StyleInspectorContext);

  const isActive = useMemo(() => {
    if (!keyValue) {
      return false;
    }

    return !!hasValue(keyValue);
  }, [keyValue, hasValue]);

  const handleClickResetValue = () => {
    if (!isActive) {
      return;
    }

    resetValue(keyValue);
  };

  const isBinding = useMemo(() => {
    if (!keyValue || !bindingData) {
      return false;
    }

    let binding = [];
    if (isArray(keyValue)) {
      const keys = keyValue.find(key => get(bindingData, key) === true);
      binding = keys && keys.length > 0;
    } else {
      binding = get(bindingData, keyValue);
    }

    return binding === true;
  }, [bindingData, keyValue]);

  const isInherit = useMemo(() => {
    if (!keyValue || !inheritData) {
      return false;
    }

    let inherit = [];
    if (isArray(keyValue)) {
      const key = keyValue.find(key => inheritData[key] && inheritData[key].length > 0);
      if (key) {
        inherit = get(inheritData, key, []);
      }
    } else {
      inherit = get(inheritData, keyValue, []);
    }

    return inherit.length > 0;
  }, [inheritData, keyValue]);

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
          'text-blue-400 bg-blue-200 cursor-pointer': isActive && !isBinding,
          'text-purple-400 bg-purple-200 cursor-pointer': isBinding,
          'text-orange-400 bg-orange-200 cursor-pointer': isInherit && !isActive
        })}
        onClick={handleClickResetValue}
      >
        {children}
      </label>
    </div>
  );
};

export default memo(InspectorLabel);
