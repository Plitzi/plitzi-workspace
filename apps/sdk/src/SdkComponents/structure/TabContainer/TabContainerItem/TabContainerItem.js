// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const TabContainerItem = props => {
  const { className = '', internalProps = emptyObject, children, ref } = props;
  const { tabSelected, tabIndex = 0, isHeader, onSelect } = internalProps;

  const handleClick = useCallback(() => {
    if (!isHeader || tabSelected === tabIndex) {
      return;
    }

    onSelect(tabIndex);
  }, [isHeader, tabSelected, tabIndex, onSelect]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      onClick={handleClick}
      className={classNames('plitzi-component__tab-container-item', className, {
        active: tabSelected === tabIndex
      })}
    >
      {children}
    </RootElement>
  );
};

export default withElement(TabContainerItem);

export { TabContainerItem };
