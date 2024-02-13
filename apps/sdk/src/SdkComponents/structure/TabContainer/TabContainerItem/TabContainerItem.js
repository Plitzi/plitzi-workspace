// Packages
import React, { forwardRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../../helpers/utils';

const TabContainerItem = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject, children } = props;
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
});

TabContainerItem.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  tabIndex: PropTypes.number,
  className: PropTypes.string
};

export default withElement(TabContainerItem);

export { TabContainerItem };
