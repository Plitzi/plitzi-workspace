/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject, JSX, HTMLAttributes } from 'react';

export type NodeHtmlProps<T extends keyof JSX.IntrinsicElements = 'span'> = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: T;
  internalProps: InternalPropsSTG2;
  children?: ReactNode;
} & Omit<HTMLAttributes<T>, 'class'>;

const NodeHtml = ({ ref, className = '', subType = 'span', internalProps, children, ...otherProps }: NodeHtmlProps) => {
  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames(`plitzi-component__node-html plitzi-component__node-html-${subType}`, className)}
      {...(otherProps as Record<string, unknown>)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(NodeHtml);

export { NodeHtml };
