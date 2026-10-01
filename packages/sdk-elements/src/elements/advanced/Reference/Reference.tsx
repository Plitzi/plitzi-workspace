/* eslint-disable react-refresh/only-export-components */

import clsx from 'clsx';
import { useId, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import { COMPONENT_PROPS_SOURCE } from '@plitzi/sdk-shared/schema/schemaConstants';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import useInternalItems from '../../../Element/hooks/useInternalItems';
import LayoutBody from '../../../Element/LayoutBody';
import PluginManager from '../../../Element/PluginManager';
import ReplicaProvider from '../../../Element/ReplicaProvider';
import RootElement from '../../../Element/RootElement';

import type { Element, ElementLayout, SpaceComponent } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ReferenceProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  /** `element` renders another element of the space; `component` places one of the space's components. */
  referenceType: 'element' | 'component';
  /** The element's id, or the component's. */
  referenceId: string;
};

/**
 * What an instance hands its component: every prop the component declares, from the instance's attribute of that
 * name, else the declared default, else `null`. Each one is always there, so a prop an instance leaves out never reads
 * the value an instance further out handed in under the same name.
 */
const propsOf = (component: SpaceComponent, attributes: Element['attributes']): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(component.props ?? {}).map(([name, prop]) => [name, attributes[name] ?? prop.default ?? null])
  );

type SlotItemsProps = {
  instance: Element['definition'];
  instanceId: string;
  items: string[];
  plitziElementLayout?: ElementLayout;
  previewMode: boolean;
};

/** The instance's children that fill one slot, rendered the way any element's items are. */
const SlotItems = ({ instance, instanceId, items, plitziElementLayout, previewMode }: SlotItemsProps) => {
  const definition = useMemo(() => ({ ...instance, items }), [instance, items]);

  return useInternalItems({ id: instanceId, definition, plitziElementLayout, children: undefined, previewMode });
};

type ComponentInstanceProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  componentId: string;
  previewMode: boolean;
};

/**
 * One instance of a component: its tree, in a scope of its own.
 *
 * The scope is a list row's: a replica of the interactions manager, and a store segment of its own so the same ids
 * placed twice keep apart the state they hold. On top of the page it carries the component's tree — the elements the
 * instance renders are found by id like any other — and `props`, which is all a component reads of where it is.
 */
const ComponentInstance = ({ ref, className, componentId, previewMode }: ComponentInstanceProps) => {
  const {
    id,
    attributes,
    definition,
    plitziElementLayout: outerLayout,
    definition: { styleSelectors }
  } = useElement();
  const [components] = useCommonStore('schema.components');
  const items = useMemo(() => definition.items ?? [], [definition.items]);
  const slotPaths = useMemo(() => items.map(item => `schema.flat.${item}.attributes.slot` as const), [items]);
  const [named] = useCommonStore(slotPaths);
  const segment = useId();

  // A key read off the document: the instance may name a component that has since been removed.
  const known = Object.hasOwn(components, componentId) ? components[componentId] : undefined;
  const scope = useMemo(
    () =>
      known
        ? {
            schema: { flat: known.flat },
            runtime: { sources: { [COMPONENT_PROPS_SOURCE]: propsOf(known, attributes) } }
          }
        : {},
    [known, attributes]
  );
  const layout = useMemo<ElementLayout>(
    () => ({ slots: known?.slots ?? [], rootId: id, type: 'component' }),
    [known?.slots, id]
  );
  const bodies = useMemo(() => {
    const slots = known?.slots ?? [];
    const bySlot: Record<string, ReactNode> = {};
    for (const slot of slots) {
      const filling = items.filter((_item, index) => {
        const name = named[index];

        return (typeof name === 'string' ? name : slots[0]) === slot;
      });
      bySlot[slot] = (
        <SlotItems
          instance={definition}
          instanceId={id}
          items={filling}
          plitziElementLayout={outerLayout}
          previewMode={previewMode}
        />
      );
    }

    return bySlot;
  }, [known?.slots, items, named, definition, id, outerLayout, previewMode]);
  const internalProps = useMemo(
    () => ({ id: known?.rootId ?? '', rootId: id, className: styleSelectors.base }),
    [known?.rootId, id, styleSelectors.base]
  );

  const root = known ? known.flat[known.rootId] : undefined;
  const replica = root && (
    <ReplicaProvider>
      <StoreProvider inherit="live" name={`Component:${componentId}:${id}`} segment={segment} value={scope}>
        <LayoutBody bodies={bodies}>
          <PluginManager
            key={`${id}_${componentId}`}
            type={root.definition.type}
            internalProps={internalProps}
            plitziElementLayout={layout}
          />
        </LayoutBody>
      </StoreProvider>
    </ReplicaProvider>
  );

  if (previewMode && replica) {
    return replica;
  }

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__reference', className, { 'reference--build-mode': !previewMode })}
    >
      {replica}
      {!previewMode && !root && <div className="reference__label">Component {componentId} not found</div>}
    </RootElement>
  );
};

type ElementReferenceProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  referenceId: string;
  previewMode: boolean;
};

/** Another element of the space, rendered here as a replica of it — the scope a list row gets. */
const ElementReference = ({ ref, className, referenceId, previewMode }: ElementReferenceProps) => {
  const {
    id,
    definition: { rootId, styleSelectors }
  } = useElement();
  const [found] = useCommonStore(`schema.flat.${referenceId}`);
  // A path into a keyed map: its type promises an element at every key, and the document may hold none at this one.
  const element = found as Element | undefined;
  // Each reference is a replica of what it names, so it gets the scope a list row gets: the same ids rendered twice
  // keep apart the state they hold, and interactions run in a child manager of their own.
  const segment = useId();

  const internalPropsMemo = useMemo(
    () => ({ id: element?.id ?? '', rootId, className: styleSelectors.base }),
    [element?.id, rootId, styleSelectors.base]
  );

  const replica = element && (
    <ReplicaProvider>
      <StoreProvider inherit="live" name={`Reference:${id}`} segment={segment}>
        <PluginManager key={`${id}_${referenceId}`} type={element.definition.type} internalProps={internalPropsMemo} />
      </StoreProvider>
    </ReplicaProvider>
  );

  if (previewMode && replica) {
    return replica;
  }

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__reference', className, { 'reference--build-mode': !previewMode })}
    >
      {replica}
      {!previewMode && !element && <div className="reference__label">Element Reference</div>}
    </RootElement>
  );
};

const Reference = ({ ref, className = '', referenceType = 'element', referenceId = '' }: ReferenceProps) => {
  const {
    settings: { previewMode = true }
  } = usePlitziServiceContext();

  if (referenceType === 'component') {
    return <ComponentInstance ref={ref} className={className} componentId={referenceId} previewMode={previewMode} />;
  }

  return <ElementReference ref={ref} className={className} referenceId={referenceId} previewMode={previewMode} />;
};

export default withElement(Reference);

export { Reference };
