/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

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
    | 'dd'
    // A row of a list, where the list's own items would bring a template they do not need.
    | 'li'
    // A heading made of parts — a word in another colour, an icon, a badge — which a `heading` cannot hold.
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6';
  children?: ReactNode;
};

const Container = ({ ref, className = '', subType = 'div', children }: ContainerProps) => {
  return (
    <RootElement
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
