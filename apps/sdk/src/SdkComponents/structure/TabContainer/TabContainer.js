// Packages
import React, { forwardRef, useState, cloneElement } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../helpers/utils';

const TabContainer = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject, children } = props;
  const [tabSelected, setTabSelected] = useState(0);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container', className)}
    >
      {Array.isArray(children) &&
        children.map(child =>
          cloneElement(child, {
            ...child.props,
            internalProps: { ...child.props.internalProps, onSelect: setTabSelected, tabSelected }
          })
        )}
    </RootElement>
  );
});

TabContainer.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  children: PropTypes.node
};

export default withElement(TabContainer);

export { TabContainer };
