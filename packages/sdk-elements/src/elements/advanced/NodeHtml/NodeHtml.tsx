/* eslint-disable react-refresh/only-export-components */
import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import clsx from 'clsx';
import { useMemo } from 'react';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ReactNode, RefObject, JSX, HTMLAttributes } from 'react';

export type NodeHtmlProps<T extends keyof JSX.IntrinsicElements = 'span'> = {
  id: string;
  ref?: RefObject<HTMLElement>;
  className?: string;
  subType?: T;
  children?: ReactNode;
} & Omit<HTMLAttributes<T>, 'class'>;

// `id` is destructured out so it never reaches `otherProps`, which is spread onto the DOM node.
const NodeHtml = ({ id, ref, className = '', subType = 'span', children, ...otherProps }: NodeHtmlProps) => {
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
      id={id}
      ref={ref}
      tag={subType}
      className={clsx(`plitzi-component__node-html plitzi-component__node-html-${subType}`, className)}
      {...otherPropsParsed}
    >
      {children}
    </RootElement>
  );
};

export default withElement(NodeHtml);

export { NodeHtml };
