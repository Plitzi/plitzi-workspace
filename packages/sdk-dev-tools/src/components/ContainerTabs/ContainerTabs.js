// Packages
import React, { Children, useCallback, useMemo, useState, cloneElement, isValidElement } from 'react';
import classNames from 'classnames';

// Relatives
import Tabs from './Tabs';
import TabContent from './TabContent';

/**
 * @param {{
 *   className?: string;
 *   children?: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const ContainerTabs = props => {
  const { children, className } = props;
  const [tabSelected, setTabSelected] = useState(0);

  const handleSelect = useCallback(index => setTabSelected(index), []);

  const { tabs, container } = useMemo(() => {
    const components = {
      tabs: <Tabs tabSelected={tabSelected} onSelect={handleSelect} />,
      container: <TabContent />
    };

    let containerIndex = 0;
    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type === Tabs) {
        components.tabs = cloneElement(child, { ...child.props, tabSelected, onSelect: handleSelect });
      } else if (child.type === TabContent && containerIndex++ === tabSelected) {
        components.container = cloneElement(child, { ...child.props });
      }
    });

    return components;
  }, [children, tabSelected, handleSelect]);

  return (
    <div className={classNames('flex flex-col', className)}>
      {tabs}
      {container}
    </div>
  );
};

ContainerTabs.Tabs = Tabs;

ContainerTabs.TabContent = TabContent;

export default ContainerTabs;
