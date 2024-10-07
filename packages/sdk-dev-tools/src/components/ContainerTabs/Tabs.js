// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';

// Relatives
import Tab from './Tab';

/**
 * @param {{
 *   className?: string;
 *   items?: object;
 *   tabSelected?: number;
 *   onSelect?: (index: number) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Tabs = props => {
  const { className, items = [], tabSelected = 0, onSelect = noop } = props;

  return (
    <div className={classNames('flex bg-gray-200 rounded w-[80%] mx-auto p-1 select-none', className)}>
      {items.map((item, i) => (
        <Tab key={i} index={i} label={item.label} tabSelected={tabSelected === i} onSelect={onSelect} />
      ))}
    </div>
  );
};

export default Tabs;
