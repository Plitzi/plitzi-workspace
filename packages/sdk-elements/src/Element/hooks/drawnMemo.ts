import { useCallback, useMemo } from 'react';

import type { DependencyList } from 'react';

const isServer = typeof window === 'undefined';

const madeNow = <T>(make: () => T): T => make();

const asItIs = <T extends (...args: never[]) => unknown>(callback: T): T => callback;

/**
 * `useMemo` in the browser, where an element is drawn again and what its memos keep is what the next draw is compared
 * by; on the server, which draws each element once, the value as it is made. React's memo there was the value and its
 * dependencies kept for every memo of every element of a page, for a second draw that never comes — and a component
 * that suspends is drawn again from nothing, memos and all.
 *
 * The rules of hooks hold: which of the two it is is decided as the module loads, for the life of the process.
 */
export const useDrawnMemo: <T>(make: () => T, deps: DependencyList) => T = isServer ? madeNow : useMemo;

/** `useCallback` the same way: in the browser, the same function while its dependencies are; on the server, this one. */
export const useDrawnCallback: <T extends (...args: never[]) => unknown>(callback: T, deps: DependencyList) => T =
  isServer ? asItIs : useCallback;
