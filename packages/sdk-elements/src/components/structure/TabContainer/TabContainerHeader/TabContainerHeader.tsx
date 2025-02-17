import React from 'react';
import classNames from 'classnames';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import RootElement from '../../../../Element/RootElement';
import withElement from '../../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const TabContainerHeader = props => {
  const { ref, className = '', internalProps = emptyObject, children } = props;
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
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
