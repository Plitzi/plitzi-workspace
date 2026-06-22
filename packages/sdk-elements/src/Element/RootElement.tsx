import { useMemo } from 'react';

import parseStyle from './helpers/parseStyle';
import useElement from './hooks/useElement';
import RootElementResolved from './RootElementResolved';
import StaticTag from './StaticTag';

import type { ElementTag, RootElementProps } from './RootElement.types';
import type { JSX } from 'react';

const RootElement = <T extends keyof JSX.IntrinsicElements = 'div'>({
  id,
  ref,
  children,
  tag = 'div' as T,
  className = '',
  interactionTriggers,
  interactionCallbacks,
  style: styleProp,
  ...otherProps
}: RootElementProps<T>) => {
  const styleParsed = useMemo(() => parseStyle(styleProp), [styleProp]);
  const Tag = tag as unknown as ElementTag | undefined;
  const elementContext = useElement(id);
  if (!Tag) {
    throw new Error(`One of these parameters [tag] is missing in elementId: ${id}`);
  }

  if (elementContext.plitziJsxSkipHOC) {
    return (
      <StaticTag Tag={Tag} refProp={ref} style={styleParsed} className={className} otherProps={otherProps}>
        {children}
      </StaticTag>
    );
  }

  return (
    <RootElementResolved
      elementContext={elementContext}
      Tag={Tag}
      refProp={ref}
      styleParsed={styleParsed}
      className={className}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
      otherProps={otherProps}
    >
      {children}
    </RootElementResolved>
  );
};

export default RootElement;

export { RootElement };
