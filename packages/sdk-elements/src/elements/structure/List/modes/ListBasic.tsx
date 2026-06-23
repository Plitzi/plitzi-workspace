import clsx from 'clsx';

import RootElement from '../../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type ListBasicProps = {
  id: string;
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: 'ul' | 'ol';
  children?: ReactNode;
};

const ListBasic = ({ ref, className = '', subType = 'ul', children }: ListBasicProps) => {
  return (
    <RootElement ref={ref} tag={subType} className={clsx('plitzi-component__list', className)}>
      {children}
    </RootElement>
  );
};

export default ListBasic;
