/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '../../../types/ElementTypes';
import type { ReactNode, RefObject } from 'react';

export type ContainerProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  subType:
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
  internalProps: InternalProps;
  children: ReactNode;
};

const Container = ({
  ref,
  className = '',
  subType = 'div',
  internalProps = emptyObject as InternalProps,
  children
}: ContainerProps) => {
  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__container', className)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(Container);

export { Container };
