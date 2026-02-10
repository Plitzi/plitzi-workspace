import { createContext, useMemo } from 'react';

import type { Element } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type ElementContextValue = { id: string; rootId?: string } & (
  | { plitziJsxSkipHOC: true }
  | {
      plitziJsxSkipHOC?: false;
      attributes: Element['attributes'];
      definition: Element['definition'];
      style?: CSSProperties;
      setElementState: <T extends Record<string, unknown> = Record<string, unknown>>(
        value?: T | ((prev: T) => T)
      ) => boolean;
    }
);

const elementContextDefaultValue = {} as ElementContextValue;

// eslint-disable-next-line react-refresh/only-export-components
export const ElementContext = createContext<ElementContextValue>(elementContextDefaultValue);

export type ElementProviderProps = {
  children: ReactNode;
  id: string;
  rootId?: string;
  plitziJsxSkipHOC?: boolean;
  attributes?: Element['attributes'];
  definition?: Element['definition'];
  style?: CSSProperties;
  setElementState?: <T extends Record<string, unknown> = Record<string, unknown>>(
    value?: T | ((prev: T) => T)
  ) => boolean;
} & ElementContextValue;

const ElementProvider = ({
  children,
  id,
  rootId,
  plitziJsxSkipHOC = false,
  attributes,
  definition,
  style,
  setElementState
}: ElementProviderProps) => {
  const value = useMemo<ElementContextValue>(() => {
    if (plitziJsxSkipHOC) {
      return { id, rootId, plitziJsxSkipHOC } as ElementContextValue;
    }

    return { id, rootId, plitziJsxSkipHOC, attributes, definition, style, setElementState } as ElementContextValue;
  }, [plitziJsxSkipHOC, id, rootId, attributes, definition, style, setElementState]);

  return <ElementContext value={value}>{children}</ElementContext>;
};

export default ElementProvider;
