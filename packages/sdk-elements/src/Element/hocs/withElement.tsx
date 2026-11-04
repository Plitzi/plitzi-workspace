import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import { memo, Profiler, use, useEffect, useId, useMemo, useRef } from 'react';

import { useStoreById } from '@plitzi/nexus/react';
import { useEventBridge } from '@plitzi/sdk-event-bridge';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { tracingCollector } from '@plitzi/sdk-shared/store/tracing';

import ElementContext from '../ElementContext';
import ElementParentContext from '../ElementParentContext';
import { declaredAttributes } from '../helpers/declaredAttributes';
import { isVisible } from '../helpers/isVisible';
import { omitKeys } from '../helpers/omitKeys';
import { useDrawnMemo } from '../hooks/drawnMemo';
import { useStoreValue } from '../hooks/storeValues';
import useElementInternal from '../hooks/useElementInternal';

import type { ElementContextValue } from '../ElementContext';
import type { ElementParentContextValue } from '../ElementParentContext';
import type { CommonState, InternalPropsSTG1 } from '@plitzi/sdk-shared';
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
/**
 * A page drawn on the server is drawn once, as text: nothing is drawn again, so the layers that keep an element from
 * being drawn again (the memo below, the parent's visibility in a context of its own) only cost there, and an error
 * boundary catches nothing — React does not use them on the server. The browser hydrates with every layer: the markup is
 * the same, which is all hydrating compares. Chosen once, as the module loads.
 */
const isServer = typeof window === 'undefined';

/**
 * The element a server element is inside, or nothing at the root: `ElementContext` is typed as always holding one, and
 * it holds its default — `undefined` — above the first element of the page.
 */
const enclosingElement = (value: ElementParentContextValue | undefined): ElementParentContextValue | undefined => value;

/**
 * What an element tells others in the browser once it is drawn, all of it in effects: its state's setter to the event
 * bridge (`<id>_setState`), and — debugging — that this instance is mounted, which the tracing collector hears no other
 * way (it would keep drawing a page navigated away from, and the body of a modal that closed).
 */
const useElementEventsInBrowser = (
  id: string,
  traceId: string,
  debugMode: boolean,
  setElementState: ElementContextValue['setElementState']
): void => {
  useEffect(() => {
    if (!debugMode) {
      return undefined;
    }

    tracingCollector.markMounted(traceId);

    return () => tracingCollector.markUnmounted(traceId);
  }, [debugMode, traceId]);

  const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: setElementState }), [id, setElementState]);
  useEventBridge('element', eventCallbacks);
};

/** Nothing on the server: no effect runs there, and nothing is listening. */
const useElementEventsOnServer = (): void => undefined;

const useElementEvents = isServer ? useElementEventsOnServer : useElementEventsInBrowser;

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
    const store = useStoreById<CommonState>();
    const element = useStoreValue(store, `schema.flat.${id}`);
    if (!element) {
      throw new Error(`Element ${id} not found, Page ${baseElementId}`);
    }

    const { internalProps, customProps, children } = useElementInternal({
      store,
      element,
      internalProps: props.internalProps,
      children: props.children,
      previewMode,
      parentVisible
    });

    const { attributes, definition, style, plitziElementLayout, elementState, setElementState } = internalProps;
    useElementEvents(id, traceId, Boolean(debugMode), setElementState);

    const visible = parentVisible && isVisible(elementState.visibility);
    const elementData = useDrawnMemo<ElementContextValue>(
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

    const parentData = useDrawnMemo<ElementParentContextValue>(() => ({ visible, traceId }), [visible, traceId]);

    const content = useDrawnMemo(() => {
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

      return isServer ? (
        <WrappedComponent {...wrappedProps} ref={ref} />
      ) : (
        <ErrorBoundary>
          <WrappedComponent {...wrappedProps} ref={ref} />
        </ErrorBoundary>
      );
    }, [internalProps.attributes, props, customProps, children, ref]);

    // On the server a child reads its parent's visibility off the parent's element context (`WithElementComponent`).
    const tree = isServer ? (
      <ElementContext value={elementData}>{content}</ElementContext>
    ) : (
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
  type ResolvedElementProps = {
    element: WithElementProps<T>;
    traceId: string;
    parentTraceId: string | undefined;
    parentVisible: boolean;
  };

  const ResolvedElementBody: FC<ResolvedElementProps> = ({ element, traceId, parentTraceId, parentVisible }) => {
    const ref = useRef<HTMLElement>(undefined);

    return useResolvedElement(element, { ref, traceId, parentTraceId, parentVisible });
  };

  const ResolvedElement = memo(ResolvedElementBody);
  ResolvedElement.displayName = `withElement(${name}).resolved`;

  /**
   * A skipHOC element passes its PARENT's trace id through rather than minting one.
   *
   * It renders no `Profiler` of its own, so a trace id here would name a node the collector never hears about, and
   * everything below it would hang off a parent that is not in the tree — which the viewer reads as a root. Passing the
   * parent through nests those descendants under the nearest ancestor that actually rendered. A component of its own, so
   * an element that is not one makes none of this.
   */
  const SkippedElement = ({
    element,
    parentVisible,
    traceId
  }: {
    element: WithElementProps<T>;
    parentVisible: boolean;
    traceId: string;
  }) => {
    const { id, rootId } = element.internalProps;
    const skipEntry = useMemo<ElementContextValue<'skipHOC'>>(
      () => ({ id, rootId, visible: parentVisible, traceId, plitziJsxSkipHOC: true }),
      [id, rootId, parentVisible, traceId]
    );
    const skipParent = useMemo<ElementParentContextValue>(
      () => ({ visible: parentVisible, traceId }),
      [parentVisible, traceId]
    );
    const tree = (
      <ElementContext value={skipEntry}>
        <WrappedComponent {...element} />
      </ElementContext>
    );

    return <ElementParentContext value={skipParent}>{tree}</ElementParentContext>;
  };

  const WithElementComponent = (props: WithElementProps<T>) => {
    const { id } = props.internalProps;
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
    if (props.plitziJsxSkipHOC) {
      return (
        <SkippedElement element={props} parentVisible={parentVisible} traceId={parentElement?.traceId ?? traceId} />
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

  /**
   * The same on the server, in one component rather than two: a page is drawn once there, so the layer that keeps an
   * element from drawing again when only its parent did has nothing to keep — and it was a component of its own for
   * every element of the page. What a skipHOC element draws is the same as in the browser, made without memos.
   */
  const ServerElement = (props: WithElementProps<T>) => {
    const { id, rootId } = props.internalProps;
    const parentElement = enclosingElement(use(ElementContext));
    const parentVisible = parentElement?.visible ?? true;
    const traceId = `${id}${useId()}`;
    if (props.plitziJsxSkipHOC) {
      const skipEntry: ElementContextValue<'skipHOC'> = {
        id,
        rootId,
        visible: parentVisible,
        traceId: parentElement?.traceId ?? traceId,
        plitziJsxSkipHOC: true
      };

      return (
        <ElementContext value={skipEntry}>
          <WrappedComponent {...props} />
        </ElementContext>
      );
    }

    // Drawn once, on the server: whether an element is skipHOC cannot change between renders that never happen, so the
    // hooks below always run in the same order.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ref = useRef<HTMLElement>(undefined);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useResolvedElement(props, { ref, traceId, parentTraceId: parentElement?.traceId, parentVisible });
  };

  const Element: FC<WithElementProps<T>> = isServer ? ServerElement : WithElementComponent;
  Element.displayName = `withElement(${name})`;

  return Element;
};

export default withElement;
