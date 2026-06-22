import type { StaticTagProps } from './RootElement.types';

// Single source of truth for the rendered tag: fixes the spread order (own props → debug params → native events →
// server marker) shared by the interactive and non-interactive branches.
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
