import clsx from 'clsx';

import RootElement from '../../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ListBasicProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: 'ul' | 'ol';
  internalProps: InternalPropsSTG2;
  children?: ReactNode;
};

const ListBasic = ({ ref, className = '', subType = 'ul', internalProps, children }: ListBasicProps) => {
  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={clsx('plitzi-component__list', className)}
    >
      {children}
    </RootElement>
  );
};

export default ListBasic;
