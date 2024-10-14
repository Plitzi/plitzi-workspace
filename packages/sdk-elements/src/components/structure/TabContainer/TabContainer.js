// Packages
import React, { useState, cloneElement } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement.js';
import withElement from '../../../Element/hocs/withElement.js';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
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
