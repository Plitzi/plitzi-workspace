import { createElement } from 'react';

import type { DebugParams } from '../RootElement';
import type { ReactNode, CSSProperties, RefObject, JSX, ReactElement } from 'react';

// Single source of truth for the rendered tag: fixes the spread order (own props → debug params → native events →
// server marker) shared by the interactive and non-interactive branches. Kept as a plain render function (not a
// component) so it does not add its own boundary to the React DevTools tree on every element.

export type StaticTagProps = {
  tag?: keyof JSX.IntrinsicElements;
  refProp?: RefObject<HTMLElement | null>;
  style?: CSSProperties;
  className: string;
  otherProps: Record<string, unknown>;
  params?: DebugParams;
  serverMarker?: { 'data-rsc-id': string };
  events?: Record<string, unknown>;
  children?: ReactNode;
};

const renderStaticTag = ({
  tag = 'div',
  refProp,
  style,
  className,
  otherProps,
  params,
  serverMarker,
  events,
  children
}: StaticTagProps): ReactElement =>
  createElement(
    tag,
    {
      ref: refProp as RefObject<HTMLDivElement>,
      style,
      className,
      ...otherProps,
      ...params,
      ...events,
      ...serverMarker
    },
    children
  );

export default renderStaticTag;
