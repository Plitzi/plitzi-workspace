/* eslint-disable react-refresh/only-export-components */
import { use, useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react';

import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

import type { ReactNode } from 'react';

type BodyStore = { current: Record<string, ReactNode>; listeners: Set<() => void> };

const LayoutBodyContext = sharedContext<BodyStore | undefined>('LayoutBodyContext', undefined);

const noopUnsubscribe = () => undefined;

export type LayoutBodyProps = {
  /**
   * What each slot of the shell below renders, by the slot's id: a layout's one slot holds the page's content (or the
   * shell nested inside this one), and a component instance's slots hold the children that name them.
   */
  bodies: Record<string, ReactNode>;
  children: ReactNode;
};

/**
 * Hands a shell's slots their bodies without handing them to every element of the shell.
 *
 * The body used to travel inside `plitziElementLayout`, which every element of the shell receives as a prop. The body
 * is a new node on every navigation — it IS the page — so the whole shell rendered again each time, sidebar and all,
 * to show the one container that holds the page. Here the value every element reads never changes; only a slot
 * subscribes to what it holds.
 *
 * `current` is the bodies as of the first render, which is what the server renders and what hydration reads. Later
 * ones are announced after the commit, and the slots render them before the browser paints.
 */
const LayoutBody = ({ bodies, children }: LayoutBodyProps) => {
  const [store] = useState<BodyStore>(() => ({ current: bodies, listeners: new Set() }));

  useLayoutEffect(() => {
    if (store.current === bodies) {
      return;
    }

    store.current = bodies;
    store.listeners.forEach(listener => listener());
  }, [bodies, store]);

  return <LayoutBodyContext value={store}>{children}</LayoutBodyContext>;
};

/** The body of the nearest shell's slot `slotId`; nothing, and no subscription, for an element that is not a slot. */
export const useLayoutBody = (slotId: string | undefined): ReactNode => {
  const store = use(LayoutBodyContext);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (slotId === undefined || !store) {
        return noopUnsubscribe;
      }

      store.listeners.add(listener);

      return () => {
        store.listeners.delete(listener);
      };
    },
    [slotId, store]
  );
  const getSnapshot = useCallback(
    () => (slotId !== undefined && store ? store.current[slotId] : undefined),
    [slotId, store]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default LayoutBody;
