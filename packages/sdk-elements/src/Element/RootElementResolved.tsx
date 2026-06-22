import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import RootElementInteractive from './RootElementInteractive';
import StaticTag from './StaticTag';

import type { DebugParams, ResolvedProps } from './RootElement.types';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { Context } from 'react';

// Post-render phase: reads the service context, computes debug params + the server marker, then renders either the
// static tag (no interactions) or the interactive variant.
const RootElementResolved = (props: ResolvedProps) => {
  const { elementContext, Tag, refProp, styleParsed, className, otherProps, children } = props;
  const plitziContextData = usePlitziServiceContext();
  const previewMode = get(plitziContextData, 'settings.previewMode', true);
  const debugMode = get(plitziContextData, 'settings.debugMode', false) as boolean;
  const baseElementId = get(plitziContextData, 'root.baseElementId');

  const {
    id,
    rootId,
    definition: { type, label, runtime },
    style
  } = elementContext;
  const serverMarker = runtime === 'server' ? { 'data-rsc-id': id } : undefined;
  const params = useMemo<DebugParams>(() => {
    if (!debugMode && (previewMode || !type || rootId !== baseElementId)) {
      return {};
    }

    return {
      'data-id': id,
      'data-name': label ? label : type ? type : 'unknown',
      'data-root-id': rootId,
      'data-type': type ? type : 'unknown',
      'data-root-render-element': true
    };
  }, [debugMode, previewMode, rootId, baseElementId, id, label, type]);

  const InteractionsContext = get(plitziContextData, 'contexts.InteractionsContext') as
    | Context<InteractionsContextValue>
    | undefined;
  if (!InteractionsContext) {
    return (
      <StaticTag
        Tag={Tag}
        refProp={refProp}
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
      {...props}
      InteractionsContext={InteractionsContext}
      previewMode={previewMode}
      debugMode={debugMode}
      baseElementId={baseElementId}
      params={params}
      serverMarker={serverMarker}
    />
  );
};

export default RootElementResolved;
