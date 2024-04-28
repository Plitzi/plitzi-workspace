// Packages
import React from 'react';
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
