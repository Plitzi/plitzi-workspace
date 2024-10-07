// Packages
import React, { Children, useCallback, useMemo, useState, cloneElement, isValidElement } from 'react';
import classNames from 'classnames';

// Relatives
import Tabs from './Tabs';

/**
 * @param {{
 *   className?: string;
 *   children?: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const ContainerTabs = props => {
  const { children, className } = props;
  const [tabIndex, setTabIndex] = useState(0);

  const handleSelect = useCallback(index => setTabIndex(index), []);

  const { tabs } = useMemo(() => {
    const components = {
      tabs: <Tabs tabSelected={tabIndex} onSelect={handleSelect} />
    };

    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type === Tabs) {
        components.tabs = cloneElement(child, { ...child.props, tabSelected: tabIndex, onSelect: handleSelect });
      }
    });

    return components;
  }, [children, tabIndex, handleSelect]);

  return (
    <div className={classNames('flex flex-col', className)}>
      {tabs}
      {/* <Tabs tabSelected={tabIndex} onSelect={handleSelect} /> */}
    </div>
  );
};

ContainerTabs.Tabs = Tabs;

export default ContainerTabs;
