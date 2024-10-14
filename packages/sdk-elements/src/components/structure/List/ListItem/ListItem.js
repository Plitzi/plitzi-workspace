// Packages
import React from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../../Element/RootElement.js';
import withElement from '../../../../Element/hocs/withElement.js';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const ListItem = props => {
  const { ref, className = '', internalProps = emptyObject, children } = props;

  return (
    <RootElement
      tag="li"
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__list-item', className)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(ListItem);

export { ListItem };
