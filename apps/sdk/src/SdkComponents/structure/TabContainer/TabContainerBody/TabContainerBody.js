// Packages
import React, { forwardRef, cloneElement } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../../helpers/utils';

const TabContainerBody = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject, children } = props;
  const { onSelect, tabSelected } = internalProps;

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container-body', className)}
    >
      {Array.isArray(children) &&
        children.map((child, i) =>
          cloneElement(child, { ...child.props, internalProps: { onSelect, tabSelected, tabIndex: i } })
        )}
    </RootElement>
  );
});

TabContainerBody.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string
};

export default withElement(TabContainerBody);

export { TabContainerBody };
