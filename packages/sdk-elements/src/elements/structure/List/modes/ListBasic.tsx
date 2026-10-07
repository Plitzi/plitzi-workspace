import clsx from 'clsx';

import RootElement from '../../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type ListBasicProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: 'ul' | 'ol';
  children?: ReactNode;
  /** The list's accessible name. */
  label?: string;
};

const ListBasic = ({ ref, className = '', subType = 'ul', children, label = '' }: ListBasicProps) => {
  return (
    <RootElement
      ref={ref}
      tag={subType}
      className={clsx('plitzi-component__list', className)}
      aria-label={label || undefined}
    >
      {children}
    </RootElement>
  );
};

export default ListBasic;
