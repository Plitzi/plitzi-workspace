import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { useMemo, useRef } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import { ElementContext } from '../ElementContext';
import { omitKeys } from '../helpers/omitKeys';
import useElementInternal from '../hooks/useElementInternal';

import type { ElementContextValue, SkipHocElementContextValue } from '../ElementContext';
import type { CommonState, Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode } from 'react';

// Only "stateful" elements get a nexus scope so devtools/history can observe their state; every other element keeps
// cheap local `useState` (the perf floor — wrapping every element in a live scope is ~3x slower to mount). An element
// is stateful when EITHER its component writes element state internally (declared via `withElement(C, { stateful })`
// — Form, Dropdown, Dialog, Modal…) OR it carries interactions (which can run the `setState` action). A non-scoped
// element targeted out-of-band (event bridge) still works: `useElementState` falls back to `useState`.
const hasInteractions = (definition: Element['definition']): boolean =>
  !!definition.interactions && Object.keys(definition.interactions).length > 0;

export type WithElementOptions = {
  // The component reads/writes its own element `state` (not only via authored interactions), so it always needs the
  // nexus-backed scope regardless of the element's interactions.
  stateful?: boolean;
};

// A stateful element owns a live scope holding its private `state` slice (read/written through `useElementState`). It
// is seeded once and never re-synced (`autoSync={false}`); `runtime.sources`/schema fall through to the parent, while
// `state` writes stay local and isolated (`isolate={['state']}` — no deep-merge with an ancestor element's state).
// `segment={id}` gives the scope a position-derived `scopePath` so the same element rendered in several places stays
// distinct (devtools/per-instance identity).
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

const withElement = <T extends object>(WrappedComponent: FC<T>, options: WithElementOptions = {}) => {
  const { stateful = false } = options;

  const SkipHocElement = (props: WithElementProps<T>) => {
    const { id, rootId } = props.internalProps;
    const entry = useMemo<SkipHocElementContextValue>(() => ({ id, rootId, plitziJsxSkipHOC: true }), [id, rootId]);

    return (
      <ElementContext value={entry}>
        <WrappedComponent {...props} />
      </ElementContext>
    );
  };

  const FullElementInner = ({
    element,
    scoped,
    ...props
  }: WithElementProps<T> & { element: Element; scoped: boolean }) => {
    const ref = useRef<HTMLElement>(undefined);
    const { id, rootId } = props.internalProps;
    const {
      settings: { previewMode }
    } = usePlitziServiceContext();

    const { internalProps, customProps, children } = useElementInternal({
      element,
      scoped,
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

    const scoped = stateful || hasInteractions(element.definition);
    const inner = <FullElementInner {...props} element={element} scoped={scoped} />;
    if (!scoped) {
      return inner;
    }

    return (
      <StoreProvider<ElementScopeState>
        inherit="live"
        autoSync={false}
        isolate={isolatedKeys}
        segment={id}
        value={initialScope}
      >
        {inner}
      </StoreProvider>
    );
  };

  const WithElementComponent = (props: WithElementProps<T>) =>
    props.plitziJsxSkipHOC ? <SkipHocElement {...props} /> : <FullElement {...props} />;

  WithElementComponent.displayName = `withElement(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithElementComponent;
};

export default withElement;
