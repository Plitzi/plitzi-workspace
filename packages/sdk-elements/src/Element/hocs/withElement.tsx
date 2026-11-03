import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { memo, Profiler, use, useEffect, useId, useMemo, useRef } from 'react';

import { useEventBridge } from '@plitzi/sdk-event-bridge';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useCommonStore } from '@plitzi/sdk-shared/store';
import { tracingCollector } from '@plitzi/sdk-shared/store/tracing';

import ElementContext from '../ElementContext';
import ElementParentContext from '../ElementParentContext';
import { declaredAttributes } from '../helpers/declaredAttributes';
import { isVisible } from '../helpers/isVisible';
import { omitKeys } from '../helpers/omitKeys';
import useElementInternal from '../hooks/useElementInternal';

import type { ElementContextValue } from '../ElementContext';
import type { ElementParentContextValue } from '../ElementParentContext';
import type { Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { FC, ReactNode, RefObject } from 'react';

export type WithElementProps<T> = {
  plitziJsxSkipHOC?: boolean;
  internalProps: InternalPropsSTG1;
  className?: string;
  children?: ReactNode;
  extraProps?: Record<string, unknown>;
} & T;

// Two levels per element: a light reader of the parent's visibility — which, under `plitziJsxSkipHOC`, is the whole of
// what the element does — and the resolution (`ResolvedElement`), memoized, so a change of that context draws only the
// elements whose own visibility it changed.
const withElement = <T extends object>(WrappedComponent: FC<T>) => {
  const name = WrappedComponent.displayName || WrappedComponent.name;

  /**
   * The element resolved — its data from the store, its state, what the wrapped component is given — and drawn: every
   * hook a full element runs. Its own hook so the one place a render skips it (`plitziJsxSkipHOC`) is one call, not the
   * rule turned off for the whole file.
   */
  const useResolvedElement = (
    props: WithElementProps<T>,
    {
      ref,
      traceId,
      parentTraceId,
      parentVisible
    }: {
      ref: RefObject<HTMLElement | undefined>;
      traceId: string;
      parentTraceId: string | undefined;
      parentVisible: boolean;
    }
  ): ReactNode => {
    const { id, rootId } = props.internalProps;
    const {
      settings: { previewMode, debugMode },
      root: { baseElementId }
    } = usePlitzi();
    // The collector hears renders and never teardowns, so it is told when this instance leaves — or it keeps drawing a
    // page that was navigated away from, and the body of a modal that closed.
    useEffect(() => {
      if (!debugMode) {
        return undefined;
      }

      tracingCollector.markMounted(traceId);

      return () => tracingCollector.markUnmounted(traceId);
    }, [debugMode, traceId]);

    const [element] = useCommonStore(`schema.flat.${id}`);
    if (!(element as Element | undefined)) {
      throw new Error(`Element ${id} not found, Page ${baseElementId}`);
    }

    const { internalProps, customProps, children } = useElementInternal({
      element,
      internalProps: props.internalProps,
      children: props.children,
      previewMode,
      parentVisible
    });

    const { attributes, definition, style, plitziElementLayout, elementState, setElementState } = internalProps;
    const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: setElementState }), [id, setElementState]);
    useEventBridge('element', eventCallbacks);

    const visible = parentVisible && isVisible(elementState.visibility);
    const elementData = useMemo<ElementContextValue>(
      () => ({
        id,
        rootId,
        visible,
        traceId,
        attributes,
        definition,
        plitziElementLayout,
        style,
        elementState,
        setElementState
      }),
      [attributes, definition, elementState, id, plitziElementLayout, rootId, style, setElementState, visible, traceId]
    );

    const parentData = useMemo<ElementParentContextValue>(() => ({ visible, traceId }), [visible, traceId]);

    const content = useMemo(() => {
      let wrappedProps = {
        ...declaredAttributes(WrappedComponent, internalProps.attributes),
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
    }, [internalProps.attributes, props, customProps, children, ref]);

    const tree = (
      <ElementParentContext value={parentData}>
        <ElementContext value={elementData}>{content}</ElementContext>
      </ElementParentContext>
    );

    if (debugMode) {
      // Registers the real render-tree parent so the collector/flamegraph nest correctly across schemas, and which
      // element this instance is — React hands `onRender` nothing but the Profiler's id. Whether the element rendered
      // itself vs only a descendant did is derived later from self time, not flagged here.
      tracingCollector.linkParent(traceId, parentTraceId, id);

      // Snapshot the inputs that feed this element (its resolved data + the props handed to the wrapped component); the
      // collector diffs them against the last COMMITTED render's, so the panel can attribute "which prop changed".
      // `visible` is the parent's too: a section shown once its data arrives draws every element in it again, and that
      // is a change to each of them, not a render for nothing. `internalProps` is what the parent handed it: a new one
      // with the same id is the parent drawing the element again rather than keeping it — a change of reference only,
      // the parent's to fix — where none is a context or the store moving the element by itself.
      const inputs: Record<string, unknown> = {
        internalProps: props.internalProps,
        visible,
        attributes,
        definition,
        style,
        elementState,
        plitziElementLayout,
        children,
        ...customProps,
        ...props.extraProps,
        ...omitKeys(props, ['plitziJsxSkipHOC', 'internalProps', 'className', 'children', 'extraProps'])
      };
      tracingCollector.recordInputs(traceId, inputs);

      return (
        <Profiler id={traceId} onRender={tracingCollector.onRender}>
          {tree}
        </Profiler>
      );
    }

    return tree;
  };

  /**
   * The element resolved, apart from the context it is told its parent's visibility by: a context's change draws every
   * reader below it, and an element that stays hidden as its section is shown — a closed group's links as the sidebar
   * opens — has nothing new to draw. The reader above (`WithElementComponent`) is drawn, and hands this the parent's
   * visibility; this draws only when that, or what its own parent gave it, changed.
   */
  const ResolvedElement = memo(
    ({
      element,
      traceId,
      parentTraceId,
      parentVisible
    }: {
      element: WithElementProps<T>;
      traceId: string;
      parentTraceId: string | undefined;
      parentVisible: boolean;
    }) => {
      const ref = useRef<HTMLElement>(undefined);

      return useResolvedElement(element, { ref, traceId, parentTraceId, parentVisible });
    }
  );
  ResolvedElement.displayName = `withElement(${name}).resolved`;

  const WithElementComponent = (props: WithElementProps<T>) => {
    const { id, rootId } = props.internalProps;
    // The enclosing element context is this element's real render-tree parent (nests across schemas/rootIds). Read
    // before the skipHOC branch so both branches keep the visibility chain going: a skipHOC element resolves no state
    // of its own, but its descendants still have to see that an ancestor hid them.
    const parentElement = use(ElementParentContext);
    const parentVisible = parentElement?.visible ?? true;
    /**
     * This instance's tracing identity — see `ElementContextValue.traceId`.
     *
     * `useId` and not the element id, because a controlled list renders the same element once per row and the panel
     * has to tell those rows apart. Read unconditionally: `debugMode` is a runtime toggle, and a hook whose call
     * depended on it would change the hook order of every element on the page the moment somebody pressed it.
     */
    const instanceId = useId();
    const traceId = `${id}${instanceId}`;
    /**
     * A skipHOC element passes its PARENT's trace id through rather than minting one.
     *
     * It renders no `Profiler` of its own, so a trace id here would name a node the collector never hears about, and
     * everything below it would hang off a parent that is not in the tree — which the viewer reads as a root. Passing
     * the parent through nests those descendants under the nearest ancestor that actually rendered.
     */
    const skipTraceId = parentElement?.traceId ?? traceId;
    const skipEntry = useMemo<ElementContextValue<'skipHOC'>>(
      () => ({ id, rootId, visible: parentVisible, traceId: skipTraceId, plitziJsxSkipHOC: true }),
      [id, rootId, parentVisible, skipTraceId]
    );

    const skipParent = useMemo<ElementParentContextValue>(
      () => ({ visible: parentVisible, traceId: skipTraceId }),
      [parentVisible, skipTraceId]
    );

    if (props.plitziJsxSkipHOC) {
      return (
        <ElementParentContext value={skipParent}>
          <ElementContext value={skipEntry}>
            <WrappedComponent {...props} />
          </ElementContext>
        </ElementParentContext>
      );
    }

    return (
      <ResolvedElement
        element={props}
        traceId={traceId}
        parentTraceId={parentElement?.traceId}
        parentVisible={parentVisible}
      />
    );
  };

  WithElementComponent.displayName = `withElement(${name})`;

  return WithElementComponent;
};

export default withElement;
