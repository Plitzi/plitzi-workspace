/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ContainerProps = {
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
  internalProps: InternalPropsSTG2;
  children?: ReactNode;
  style?: string;
};

const Container = ({ ref, className = '', subType = 'div', internalProps, children, style }: ContainerProps) => {
  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={clsx(`plitzi-component__container plitzi-component__container-${subType}`, className)}
      style={style}
    >
      {children}
    </RootElement>
  );
};

export default withElement(Container);

export { Container };
