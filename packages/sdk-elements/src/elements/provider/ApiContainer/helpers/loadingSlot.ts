import { Children, isValidElement } from 'react';

import type { ReactNode } from 'react';

/**
 * The children a provider with a loading slot shows: the slot alone until its first answer, everything but the slot
 * after. A child is the element of that id by its key — the one every element of the tree is rendered under.
 */
export const childrenWhile = (children: ReactNode, slot: string, loading: boolean): ReactNode[] =>
  Children.toArray(children).filter(child => {
    const isSlot = isValidElement(child) && typeof child.key === 'string' && child.key.endsWith(`$${slot}`);

    return loading ? isSlot : !isSlot;
  });
