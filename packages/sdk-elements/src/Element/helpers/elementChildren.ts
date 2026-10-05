import { Children, isValidElement } from 'react';

import ServerStaticShell from '../ServerStaticShell';

import type { ReactElement, ReactNode } from 'react';

/** One of the space's elements among a component's children, and the id the space knows it by. */
export type ElementChild = { id: string; node: ReactElement };

const stringId = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

/** The id this package rendered the node under: an item's `internalProps.id`, or the shell a server element waits in. */
const idOf = (node: ReactElement): string | undefined => {
  const props = node.props as { id?: unknown; internalProps?: { id?: unknown } };

  return node.type === ServerStaticShell ? stringId(props.id) : stringId(props.internalProps?.id);
};

/**
 * The space's elements a component was given as `children`, each with its id — what a plugin that LAYS OUT the
 * elements put inside it needs: a dock that places windows in its columns, tabs, a masonry, a carousel of its own.
 *
 * A plugin whose declaration lets elements in (the builder drops them into it; `custom(…, [children])` authors them)
 * receives them already rendered, in the space's order. This hands them over with the id each was authored under, so
 * the plugin wraps each one in a box of ITS OWN — positioned, sized, stacked, hidden — keyed by that id and saved by it,
 * instead of writing styles onto an element that is not its own, which nothing promises to keep.
 *
 * ```tsx
 * const Dock = ({ children }: { children?: ReactNode }) => (
 *   <div className="dock">
 *     {elementChildren(children).map(({ id, node }) => (
 *       <section key={id} style={placementOf(id)}>{node}</section>
 *     ))}
 *   </div>
 * );
 * ```
 *
 * Anything among the children that is not one of the space's elements (a layout's page body) is left out.
 */
export const elementChildren = (children: ReactNode): ElementChild[] =>
  Children.toArray(children).flatMap(node => {
    if (!isValidElement(node)) {
      return [];
    }

    const id = idOf(node);

    return id === undefined ? [] : [{ id, node }];
  });

export default elementChildren;
