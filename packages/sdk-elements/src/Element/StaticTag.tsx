import type { DebugParams } from './RootElement';
import type { ReactNode, CSSProperties, RefObject, JSX } from 'react';

// Single source of truth for the rendered tag: fixes the spread order (own props → debug params → native events → server marker) shared by the interactive and non-interactive branches.

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

const StaticTag = ({
  tag = 'div',
  refProp,
  style,
  className,
  otherProps,
  params,
  serverMarker,
  events,
  children
}: StaticTagProps) => {
  const Tag = tag as JSX.IntrinsicElements[typeof tag] extends JSX.IntrinsicElements ? typeof tag : 'div';

  return (
    <Tag
      ref={refProp as RefObject<HTMLDivElement>}
      style={style}
      className={className}
      {...otherProps}
      {...params}
      {...events}
      {...serverMarker}
    >
      {children}
    </Tag>
  );
};

export default StaticTag;
