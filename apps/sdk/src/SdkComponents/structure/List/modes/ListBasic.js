// Packages
import React from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import RootElement from '@modules/Element/RootElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   subType: 'ul' | 'ol';
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const ListBasic = props => {
  const { ref, className = '', subType = 'ul', internalProps = emptyObject, children } = props;

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__list', className)}
    >
      {children}
    </RootElement>
  );
};

export default ListBasic;
