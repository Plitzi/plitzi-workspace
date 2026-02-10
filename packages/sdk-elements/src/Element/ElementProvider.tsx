import { createContext, useMemo } from 'react';

import type { Element } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type ElementContextValue = { id: string; rootId?: string } & (
  | { plitziJsxSkipHOC: true }
  | {
      plitziJsxSkipHOC?: false;
      className?: string;
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

// eslint-disable-next-line react-refresh/only-export-components
export const ElementContext = createContext<ElementContextValue>(elementContextDefaultValue);

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
} & ElementContextValue;

const ElementProvider = ({
  children,
  className,
  id,
  rootId,
  plitziJsxSkipHOC = false,
  attributes,
  definition,
  elementState = {},
  style,
  setElementState
}: ElementProviderProps) => {
  const value = useMemo<ElementContextValue>(() => {
    if (plitziJsxSkipHOC) {
      return { id, rootId, plitziJsxSkipHOC } as ElementContextValue;
    }

    return {
      className,
      id,
      rootId,
      plitziJsxSkipHOC,
      attributes,
      definition,
      style,
      elementState,
      setElementState
    } as ElementContextValue;
  }, [plitziJsxSkipHOC, className, id, rootId, attributes, definition, style, elementState, setElementState]);

  return <ElementContext value={value}>{children}</ElementContext>;
};

export default ElementProvider;
