import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { useMemo, useRef } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import { ElementContext } from '../ElementContext';
import { omitKeys } from '../helpers/omitKeys';
import useElementInternal from '../hooks/useElementInternal';

import type { ElementContextValue } from '../ElementContext';
import type { CommonState, Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

// Every element owns a live scope holding its private `state` slice (read/written through `useElementState`) so its
// state is uniformly nexus-backed — observable and reachable out-of-band — regardless of whether it carries
// interactions. The scope is seeded once and never re-synced (`autoSync={false}`); `runtime.sources`/schema fall
// through to the parent, while `state` writes stay local and isolated (`isolate={['state']}` — no deep-merge with an
// ancestor element's state). `segment={id}` gives the scope a position-derived `scopePath` so the same element
// rendered in several places stays distinct (devtools/per-instance identity).
type ElementScopeState = CommonState & { state: Record<string, unknown> };

const initialScope: { state: Record<string, unknown> } = { state: {} };

const isolatedKeys: ReadonlyArray<string> = ['state'];

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  internalProps: InternalPropsSTG1;
  className?: string;
  children?: ReactNode;
  extraProps?: Record<string, unknown>;
} & T;

const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const SkipHocElement = (props: WithElementProps<T>) => {
    const { id, rootId } = props.internalProps;
    const entry = useMemo<ElementContextValue<'skipHOC'>>(() => ({ id, rootId, plitziJsxSkipHOC: true }), [id, rootId]);

    return (
      <ElementContext value={entry}>
        <WrappedComponent {...props} />
      </ElementContext>
    );
  };

  const FullElementInner = ({ element, ...props }: WithElementProps<T> & { element: Element }) => {
    const ref = useRef<HTMLElement>(undefined);
    const { id, rootId } = props.internalProps;
    const {
      settings: { previewMode }
    } = usePlitziServiceContext();

    const { internalProps, customProps, children } = useElementInternal({
      element,
      internalProps: props.internalProps,
      children: props.children,
      previewMode
    });

    const { attributes, definition, style, plitziElementLayout, elementState, setElementState } = internalProps;
    const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: setElementState }), [id, setElementState]);
    useEventBridge('element', eventCallbacks);

    const elementData = useMemo<ElementContextValue>(
      () => ({ id, rootId, attributes, definition, plitziElementLayout, style, elementState, setElementState }),
      [attributes, definition, elementState, id, plitziElementLayout, rootId, style, setElementState]
    );

    const content = useMemo(() => {
      let wrappedProps = {
        ...internalProps.attributes,
        ...props.extraProps,
        ...customProps,
        // Props injected via other elements
        ...omitKeys(props, ['plitziJsxSkipHOC', 'internalProps', 'className', 'children', 'extraProps'])
      } as T;
      if (children) {
        wrappedProps = { ...wrappedProps, children };
      }

      return (
        <ErrorBoundary>
          <WrappedComponent {...wrappedProps} ref={ref} />
        </ErrorBoundary>
      );
    }, [internalProps.attributes, props, customProps, children]);

    return <ElementContext value={elementData}>{content}</ElementContext>;
  };

  const FullElement = (props: WithElementProps<T>) => {
    const { id } = props.internalProps;
    const {
      root: { baseElementId }
    } = usePlitziServiceContext();
    const [element] = useCommonStore(`schema.flat.${id}`);
    if (!(element as Element | undefined)) {
      throw new Error(`Element ${id} not found, Page ${baseElementId}`);
    }

    return (
      <StoreProvider<ElementScopeState>
        inherit="live"
        autoSync={false}
        isolate={isolatedKeys}
        segment={id}
        value={initialScope}
      >
        <FullElementInner {...props} element={element} />
      </StoreProvider>
    );
  };

  const WithElementComponent = (props: WithElementProps<T>) =>
    props.plitziJsxSkipHOC ? <SkipHocElement {...props} /> : <FullElement {...props} />;

  WithElementComponent.displayName = `withElement(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithElementComponent;
};

export default withElement;
