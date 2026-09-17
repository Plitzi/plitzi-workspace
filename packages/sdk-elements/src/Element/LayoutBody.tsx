/* eslint-disable react-refresh/only-export-components */
import { createContext, use, useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react';

import type { ReactNode } from 'react';

type BodyStore = { current: ReactNode; listeners: Set<() => void> };

const LayoutBodyContext = createContext<BodyStore | undefined>(undefined);
LayoutBodyContext.displayName = 'LayoutBodyContext';

const noopUnsubscribe = () => undefined;

export type LayoutBodyProps = {
  /** What the slot of the shell below renders: the page's content, or the shell nested inside this one. */
  body: ReactNode;
  children: ReactNode;
};

/**
 * Hands a shell's slot its body without handing it to every element of the shell.
 *
 * The body used to travel inside `plitziElementLayout`, which every element of the shell receives as a prop. The body
 * is a new node on every navigation — it IS the page — so the whole shell rendered again each time, sidebar and all,
 * to show the one container that holds the page. Here the value every element reads never changes; only the slot
 * subscribes to what it holds.
 *
 * `current` is the body as of the first render, which is what the server renders and what hydration reads. Later
 * bodies are announced after the commit, and the slot renders them before the browser paints.
 */
const LayoutBody = ({ body, children }: LayoutBodyProps) => {
  const [store] = useState<BodyStore>(() => ({ current: body, listeners: new Set() }));

  useLayoutEffect(() => {
    if (store.current === body) {
      return;
    }

    store.current = body;
    store.listeners.forEach(listener => listener());
  }, [body, store]);

  return <LayoutBodyContext value={store}>{children}</LayoutBodyContext>;
};

/** The body of the nearest shell, for the element that is its slot; nothing, and no subscription, for any other. */
export const useLayoutBody = (isSlot: boolean): ReactNode => {
  const store = use(LayoutBodyContext);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!isSlot || !store) {
        return noopUnsubscribe;
      }

      store.listeners.add(listener);

      return () => {
        store.listeners.delete(listener);
      };
    },
    [isSlot, store]
  );
  const getSnapshot = useCallback(() => (isSlot && store ? store.current : undefined), [isSlot, store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default LayoutBody;
