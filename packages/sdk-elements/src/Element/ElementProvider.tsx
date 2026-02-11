/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/rules-of-hooks */
import { createContext, useMemo } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { CSSProperties, ReactNode } from 'react';

export type ElementContextValue = {
  id: string;
  rootId?: string;
  plitziElementLayout?: ElementLayout;
  attributes: Element['attributes'];
  definition: Element['definition'];
  elementState: Record<string, unknown>;
  style?: CSSProperties;
  setElementState: <T extends Record<string, unknown> = Record<string, unknown>>(
    value?: T | ((prev: T) => T)
  ) => boolean;
};

const elementContextDefaultValue = {} as ElementContextValue;

export const ElementContext = createContext<ElementContextValue>(elementContextDefaultValue);

export type ElementInternalContextValue = { id: string; rootId?: string } & (
  | { plitziJsxSkipHOC: true }
  | { plitziJsxSkipHOC?: false; className?: string }
);

const elementInternalContextDefaultValue = {} as ElementInternalContextValue;

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
  if (!plitziJsxSkipHOC) {
    const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: setElementState }), [id, setElementState]);
    useEventBridge('element', eventCallbacks, {});
  }

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
