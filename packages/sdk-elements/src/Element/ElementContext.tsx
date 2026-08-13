import { createContext } from 'react';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { CSSProperties } from 'react';

export type ElementContextValue<T extends 'skipHOC' | 'full' = 'full'> = {
  id: string;
  idRef?: string;
  rootId?: string;
  /**
   * Whether this element is on screen: its own `visibility` state AND every ancestor's, chained through this context.
   * A hidden element still renders its subtree (it is hidden in CSS, not unmounted), so anything that DOES something
   * rather than just paint — fetching, polling, submitting — reads this instead of its own state to stay inert while
   * the branch it lives in is hidden.
   */
  visible: boolean;
} & (T extends 'skipHOC'
  ? { plitziJsxSkipHOC: true }
  : {
      plitziJsxSkipHOC?: boolean;
      className?: string;
      plitziElementLayout?: ElementLayout;
      attributes: Element['attributes'];
      definition: Element['definition'];
      elementState: Record<string, unknown>;
      style?: CSSProperties;
      setElementState: <S extends Record<string, unknown> = Record<string, unknown>>(
        value?: S | ((prev: S) => S)
      ) => boolean;
    });

const ElementContext = createContext<ElementContextValue | ElementContextValue<'skipHOC'>>(
  undefined as unknown as ElementContextValue
);
ElementContext.displayName = 'ElementContext';

export default ElementContext;
