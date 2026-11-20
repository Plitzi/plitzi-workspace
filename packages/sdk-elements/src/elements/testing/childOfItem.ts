import { Children, isValidElement } from 'react';

import type { ReactElement, ReactNode } from 'react';

/**
 * The child drawn for an item, found by its key rather than its place: an item a flag switched off is not among the
 * children, so the third item may be the second child. A child's key is its item's id (`Children.toArray` writes it as
 * `.$<id>`), with the layout's suffix (`<id>_<layout>`) inside a layout.
 */
export const childOfItem = (children: ReactNode, itemId: string | undefined): ReactElement | undefined => {
  if (itemId === undefined) {
    return undefined;
  }

  return Children.toArray(children)
    .filter(isValidElement)
    .find(child => {
      const key = (child.key ?? '').replace(/^\.\$/, '');

      return key === itemId || key.startsWith(`${itemId}_`);
    });
};
