import type { DebugParams, ElementTag } from './RootElement';
import type { ReactNode, CSSProperties, RefObject } from 'react';

// Single source of truth for the rendered tag: fixes the spread order (own props → debug params → native events → server marker) shared by the interactive and non-interactive branches.

export type StaticTagProps = {
  Tag: ElementTag;
  refProp?: RefObject<HTMLElement | null>;
  style?: CSSProperties;
  className: string;
  otherProps: Record<string, unknown>;
  params?: DebugParams;
  serverMarker?: { 'data-rsc-id': string };
  events?: Record<string, unknown>;
  children?: ReactNode;
};

const StaticTag = ({
  Tag,
  refProp,
  style,
  className,
  otherProps,
  params,
  serverMarker,
  events,
  children
}: StaticTagProps) => (
  <Tag ref={refProp} style={style} className={className} {...otherProps} {...params} {...events} {...serverMarker}>
    {children}
  </Tag>
);

export default StaticTag;
