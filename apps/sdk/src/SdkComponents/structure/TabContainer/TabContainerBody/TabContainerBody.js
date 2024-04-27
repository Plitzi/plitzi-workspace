// Packages
import React, { cloneElement } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const TabContainerBody = props => {
  const { ref, className = '', internalProps = emptyObject, children } = props;
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
};

export default withElement(TabContainerBody);

export { TabContainerBody };
