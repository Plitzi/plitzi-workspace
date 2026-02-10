import { createContext, useMemo } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';

import type { Element, ElementLayoutType } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type ElementContextValue = {
  id: string;
  rootId?: string;
  plitziElementLayout?: {
    bodyChildren: ReactNode;
    containerId: string;
    referenceId: string;
    rootId: string;
    type: ElementLayoutType;
  };
  attributes: Element['attributes'];
  definition: Element['definition'];
  elementState: Record<string, unknown>;
  style?: CSSProperties;
  setElementState: <T extends Record<string, unknown> = Record<string, unknown>>(
    value?: T | ((prev: T) => T)
  ) => boolean;
};

const elementContextDefaultValue = {} as ElementContextValue;

// eslint-disable-next-line react-refresh/only-export-components
export const ElementContext = createContext<ElementContextValue>(elementContextDefaultValue);

export type ElementInternalContextValue = { id: string; rootId?: string } & (
  | { plitziJsxSkipHOC: true }
  | { plitziJsxSkipHOC?: false; className?: string }
);

const elementInternalContextDefaultValue = {} as ElementInternalContextValue;

// eslint-disable-next-line react-refresh/only-export-components
export const ElementInternalContext = createContext<ElementInternalContextValue>(elementInternalContextDefaultValue);

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
  const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: setElementState }), [id, setElementState]);
  useEventBridge('element', eventCallbacks, {});

  const value = useMemo<ElementContextValue>(() => {
    if (plitziJsxSkipHOC) {
      return {} as ElementContextValue;
    }

    return {
      id,
      rootId,
      attributes: attributes as Element['attributes'],
      definition: definition as Element['definition'],
      style,
      elementState,
      setElementState: setElementState as Exclude<typeof setElementState, undefined>
    };
  }, [attributes, definition, elementState, id, plitziJsxSkipHOC, rootId, setElementState, style]);
  const valueInternal = useMemo<ElementInternalContextValue>(() => {
    if (plitziJsxSkipHOC) {
      return { id, rootId, plitziJsxSkipHOC };
    }

    return { id, rootId, className, plitziJsxSkipHOC };
  }, [plitziJsxSkipHOC, id, rootId, className]);

  return (
    <ElementInternalContext value={valueInternal}>
      <ElementContext value={value}>{children}</ElementContext>
    </ElementInternalContext>
  );
};

export default ElementProvider;
