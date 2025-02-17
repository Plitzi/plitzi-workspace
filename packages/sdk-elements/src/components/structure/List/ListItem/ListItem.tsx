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
