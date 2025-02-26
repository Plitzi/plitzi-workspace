/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ListItemProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalProps;
  children: ReactNode;
};

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const ListItem = ({ ref, className = '', internalProps = emptyObject as InternalProps, children }: ListItemProps) => {
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
