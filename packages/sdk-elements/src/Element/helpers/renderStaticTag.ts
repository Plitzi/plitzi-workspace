import { createElement } from 'react';

import type { DebugParams } from '../RootElement';
import type { ReactNode, CSSProperties, RefObject, JSX, ReactElement } from 'react';

// Single source of truth for the rendered tag: fixes the spread order (own props → anchor → debug params → native
// events → server marker → test marker) shared by the interactive and non-interactive branches. Kept as a plain render
// function (not a component) so it does not add its own boundary to the React DevTools tree on every element.

export type StaticTagProps = {
  tag?: keyof JSX.IntrinsicElements | '';
  refProp?: RefObject<HTMLElement | null>;
  style?: CSSProperties;
  className: string;
  otherProps: Record<string, unknown>;
  /** The element's `anchor`: its `id` in the DOM, what `/page#anchor` scrolls to. */
  anchor?: string;
  params?: DebugParams;
  serverMarker?: { 'data-rsc-id': string };
  /** The element's declared motion, as the `data-motion-*` the SDK's stylesheet plays (`motionAttributes`). */
  motion?: Record<string, string>;
  /**
   * What an end-to-end test addresses this element by — and, on a component instance's root, the instance. Last in the
   * spread: nothing may shadow it.
   */
  testMarker?: { 'data-plitzi-el': string; 'data-plitzi-instance'?: string };
  events?: Record<string, unknown>;
  children?: ReactNode;
};

const renderStaticTag = ({
  tag = 'div',
  refProp,
  style,
  className,
  otherProps,
  anchor,
  params,
  serverMarker,
  motion,
  testMarker,
  events,
  children
}: StaticTagProps): ReactElement => {
  if (tag === '') {
    return children as ReactElement;
  }

  return createElement(
    tag,
    {
      ref: refProp as RefObject<HTMLDivElement>,
      style,
      className,
      ...otherProps,
      ...(anchor ? { id: anchor } : {}),
      ...params,
      ...motion,
      ...events,
      ...serverMarker,
      ...testMarker
    },
    children
  );
};

export default renderStaticTag;
