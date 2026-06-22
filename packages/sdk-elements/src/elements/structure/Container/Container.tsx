/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type ContainerProps = {
  id: string;
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?:
    | 'div'
    | 'header'
    | 'footer'
    | 'nav'
    | 'main'
    | 'section'
    | 'article'
    | 'aside'
    | 'address'
    | 'figure'
    | 'dl'
    | 'dt'
    | 'dd';
  children?: ReactNode;
};

const Container = ({ id, ref, className = '', subType = 'div', children }: ContainerProps) => {
  return (
    <RootElement
      id={id}
      ref={ref}
      tag={subType}
      className={clsx(`plitzi-component__container plitzi-component__container-${subType}`, className)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(Container);

export { Container };
