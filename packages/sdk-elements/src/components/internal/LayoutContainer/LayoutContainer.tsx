/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type LayoutContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps: InternalPropsSTG2;
  children?: ReactNode;
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
};

const LayoutContainer = ({ ref, className = '', internalProps, children, subType = 'div' }: LayoutContainerProps) => {
  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__layout-container', className)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(LayoutContainer);

export { LayoutContainer };
