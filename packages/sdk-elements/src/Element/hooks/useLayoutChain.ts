import { useCallback, useContext, useRef, useSyncExternalStore } from 'react';

import { StoreContext } from '@plitzi/nexus/react';
import { resolveLayoutChain } from '@plitzi/sdk-shared/schema/layoutChain';

import type { Element } from '@plitzi/sdk-shared';
import type { LayoutLink } from '@plitzi/sdk-shared/schema/layoutChain';

const EMPTY: LayoutLink[] = [];

const sameChain = (a: LayoutLink[], b: LayoutLink[]): boolean =>
  a.length === b.length && a.every((link, index) => link.layout === b[index].layout && link.slot === b[index].slot);

const isElement = (value: unknown): value is Element =>
  typeof value === 'object' && value !== null && 'definition' in value && 'attributes' in value;

// Every surface's store keeps the document under `schema.flat`; the store is typed per surface, so it is checked here.
const getElementFrom =
  (getPath: (path: string) => unknown) =>
  (id: string): Element | undefined => {
    const element = getPath(`schema.flat.${id}`);

    return isElement(element) ? element : undefined;
  };

/**
 * The shells around a page, innermost first — see `resolveLayoutChain`.
 *
 * Read from the store rather than from a subscription to the whole schema's value: a page re-rendered on every edit
 * anywhere in the document would be the builder rebuilding the page on each keystroke. The chain is compared with the
 * previous one, so the page renders again only when a shell in it changes which shell it sits in.
 */
const useLayoutChain = (layout: string, layoutContainer: string): LayoutLink[] => {
  const store = useContext(StoreContext);
  const last = useRef<LayoutLink[]>(EMPTY);

  const subscribe = useCallback(
    (listener: () => void) => (store ? store.subscribePath('schema.flat', listener) : () => undefined),
    [store]
  );

  const getSnapshot = useCallback(() => {
    const next =
      layout && store
        ? resolveLayoutChain(
            getElementFrom(path => store.getPath(path)),
            layout,
            layoutContainer
          )
        : EMPTY;
    if (!sameChain(last.current, next)) {
      last.current = next;
    }

    return last.current;
  }, [store, layout, layoutContainer]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default useLayoutChain;
