import { createContext } from 'react';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type ElementContextValue<T = unknown, T2 extends 'skipHOC' | 'full' = 'full'> = T &
  ({
    id: string;
    rootId?: string;
  } & (T2 extends 'skipHOC'
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
      }));

const ElementContext = createContext<ElementContextValue | ElementContextValue<unknown, 'skipHOC'>>(
  undefined as unknown as ElementContextValue
);
ElementContext.displayName = 'ElementContext';

export type ElementProviderProps = {
  children: ReactNode;
  className?: string;
  id: string;
  rootId?: string;
  plitziJsxSkipHOC?: boolean;
  attributes?: Element['attributes'];
  definition?: Element['definition'];
  elementState?: Record<string, unknown>;
  style?: CSSProperties;
  setElementState?: <T extends Record<string, unknown> = Record<string, unknown>>(
    value?: T | ((prev: T) => T)
  ) => boolean;
};

export default ElementContext;
