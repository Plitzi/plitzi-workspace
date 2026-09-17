import { createContext } from 'react';

/**
 * What an element needs from the element around it: whether that one is on screen, and its tracing identity.
 *
 * Kept apart from `ElementContext` on purpose. That context carries the whole element — its attributes, its state,
 * its style — so a parent whose state changed (a nav item lighting up on a navigation) re-rendered every child
 * reading it, for two values that had not moved. Children read this; only the element itself reads the full one.
 */
export type ElementParentContextValue = { visible: boolean; traceId: string };

const ElementParentContext = createContext<ElementParentContextValue | undefined>(undefined);
ElementParentContext.displayName = 'ElementParentContext';

export default ElementParentContext;
