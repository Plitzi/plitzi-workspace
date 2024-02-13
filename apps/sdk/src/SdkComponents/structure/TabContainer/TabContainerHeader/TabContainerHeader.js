// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../../helpers/utils';

const TabContainerHeader = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject, children } = props;
  const { onSelect, tabSelected } = internalProps;

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container-header', className)}
    >
      {Array.isArray(children) &&
        children.map((child, i) =>
          React.cloneElement(child, {
            ...child.props,
            internalProps: { isHeader: true, onSelect, tabSelected, tabIndex: i }
          })
        )}
    </RootElement>
  );
});

TabContainerHeader.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
