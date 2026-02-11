import { createContext } from 'react';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type ElementContextValue = {
  id: string;
  rootId?: string;
} & (
  | { plitziJsxSkipHOC: true }
  | {
      plitziJsxSkipHOC?: false;
      className?: string;
      plitziElementLayout?: ElementLayout;
      attributes: Element['attributes'];
      definition: Element['definition'];
      elementState: Record<string, unknown>;
      style?: CSSProperties;
      setElementState: <T extends Record<string, unknown> = Record<string, unknown>>(
        value?: T | ((prev: T) => T)
      ) => boolean;
    }
);

const elementContextDefaultValue = {} as ElementContextValue;

const ElementContext = createContext<ElementContextValue>(elementContextDefaultValue);

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
