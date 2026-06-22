import { useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import parseStyle from './helpers/parseStyle';
import useElement from './hooks/useElement';
import RootElementInteractive from './RootElementInteractive';
import StaticTag from './StaticTag';

import type { DebugParams, ElementTag, RootElementProps } from './RootElement.types';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { Context, JSX } from 'react';

// Entry + post-render phase: resolves the element's data (`useElement`), the service context and the debug params,
// then renders the manual-render static tag (`plitziJsxSkipHOC`, used by BlockJsx), the interaction-less static tag,
// or the interactive variant. The interactions wiring lives in `RootElementInteractive` because it depends on the
// optional `InteractionsContext`, which would otherwise force conditional hooks here. The service-context fields are
// read only past the `plitziJsxSkipHOC` branch so the manual-render fast-path never depends on a full context.
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
  const serviceContext = usePlitziServiceContext();

  const params = useMemo<DebugParams>(() => {
    if (elementContext.plitziJsxSkipHOC) {
      return {};
    }

    const {
      id: elementId,
      rootId,
      definition: { type, label }
    } = elementContext;
    const previewMode = serviceContext.settings.previewMode ?? true;
    const debugMode = Boolean(serviceContext.settings.debugMode);
    if (!debugMode && (previewMode || !type || rootId !== serviceContext.root.baseElementId)) {
      return {};
    }

    return {
      'data-id': elementId,
      'data-name': label ? label : type ? type : 'unknown',
      'data-root-id': rootId,
      'data-type': type ? type : 'unknown',
      'data-root-render-element': true
    };
  }, [elementContext, serviceContext]);

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

  const {
    settings,
    root: { baseElementId },
    contexts
  } = serviceContext;
  const previewMode = settings.previewMode ?? true;
  const debugMode = Boolean(settings.debugMode);
  // The service-context type declares InteractionsContext as required, but interaction-less trees (SSR, tests) omit
  // it, so we narrow to nullable to keep the static-tag fallback below.
  const InteractionsContext = contexts.InteractionsContext as Context<InteractionsContextValue> | undefined;
  const {
    definition: { runtime },
    style
  } = elementContext;
  const serverMarker = runtime === 'server' ? { 'data-rsc-id': id } : undefined;

  if (!InteractionsContext) {
    return (
      <StaticTag
        Tag={Tag}
        refProp={ref}
        style={{ ...style, ...styleParsed }}
        className={className}
        otherProps={otherProps}
        params={params}
        serverMarker={serverMarker}
      >
        {children}
      </StaticTag>
    );
  }

  return (
    <RootElementInteractive
      elementContext={elementContext}
      Tag={Tag}
      refProp={ref}
      styleParsed={styleParsed}
      className={className}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
      otherProps={otherProps}
      InteractionsContext={InteractionsContext}
      previewMode={previewMode}
      debugMode={debugMode}
      baseElementId={baseElementId}
      params={params}
      serverMarker={serverMarker}
    >
      {children}
    </RootElementInteractive>
  );
};

export default RootElement;

export { RootElement };
