import classNames from 'classnames';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ListBasicProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: 'ul' | 'ol';
  internalProps?: InternalProps;
  children?: ReactNode;
};

const ListBasic = ({
  ref,
  className = '',
  subType = 'ul',
  internalProps = emptyObject as InternalProps,
  children
}: ListBasicProps) => {
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
