// Packages
import React, { useState, cloneElement } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const TabContainer = props => {
  const { ref, className = '', internalProps = emptyObject, children } = props;
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
};

export default withElement(TabContainer);

export { TabContainer };
