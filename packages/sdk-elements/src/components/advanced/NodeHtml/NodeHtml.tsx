/* eslint-disable react-refresh/only-export-components */
import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import clsx from 'clsx';
import { useMemo } from 'react';

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
  const otherPropsMemo = useValueMemo(otherProps);
  const otherPropsParsed = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(otherPropsMemo).map(([key, value]) => [
          key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
          value
        ])
      ),
    [otherPropsMemo]
  );

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={clsx(`plitzi-component__node-html plitzi-component__node-html-${subType}`, className)}
      {...(otherPropsParsed as Record<string, unknown>)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(NodeHtml);

export { NodeHtml };
