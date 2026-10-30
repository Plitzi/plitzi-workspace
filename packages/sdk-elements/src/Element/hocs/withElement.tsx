import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { Profiler, use, useEffect, useId, useMemo, useRef } from 'react';

import { useEventBridge } from '@plitzi/sdk-event-bridge';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useCommonStore } from '@plitzi/sdk-shared/store';
import { diffProps, tracingCollector } from '@plitzi/sdk-shared/store/tracing';

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

// Single component on purpose: under `plitziJsxSkipHOC` it returns the lightweight identity-only branch before the
// heavy resolution (`useResolvedElement`). Safe because `plitziJsxSkipHOC` is invariant for a given mounted element, so
// hook order never changes across its re-renders; splitting the branches into components would only add a level to the
// React tree for every element.
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
      prevInputsRef,
      traceId,
      parentElement,
      parentVisible
    }: {
      ref: RefObject<HTMLElement | undefined>;
      prevInputsRef: RefObject<Record<string, unknown> | undefined>;
      traceId: string;
      parentElement: ElementParentContextValue | undefined;
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
      tracingCollector.linkParent(traceId, parentElement?.traceId, id);

      // Snapshot the inputs that feed this element (its resolved data + the props handed to the wrapped component) and
      // diff against the previous render, so the panel can attribute "which prop changed" to each re-render.
      const inputs: Record<string, unknown> = {
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
      tracingCollector.recordProps(traceId, diffProps(prevInputsRef.current, inputs));
      prevInputsRef.current = inputs;

      return (
        <Profiler id={traceId} onRender={tracingCollector.onRender}>
          {tree}
        </Profiler>
      );
    }

    return tree;
  };

  const WithElementComponent = (props: WithElementProps<T>) => {
    const ref = useRef<HTMLElement>(undefined);
    // Previous render's input snapshot, diffed under `debugMode` so the tracing panel can show which prop/data changed.
    // Declared unconditionally (hooks rules) even though only the debug branch reads it.
    const prevInputsRef = useRef<Record<string, unknown> | undefined>(undefined);
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

    // `plitziJsxSkipHOC` is invariant for a mounted element, so this call is made on every render of it or on none: the
    // hook order never changes. A component of its own would add a level to the React tree for every element.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useResolvedElement(props, { ref, prevInputsRef, traceId, parentElement, parentVisible });
  };

  WithElementComponent.displayName = `withElement(${name})`;

  return WithElementComponent;
};

export default withElement;
