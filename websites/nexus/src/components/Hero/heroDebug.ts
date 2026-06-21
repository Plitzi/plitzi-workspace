import { useRef } from 'react';

import { getControl, setControl, useControl } from './arcadeControls';

// The debug flag is part of the Nexus controls store. When on, interactive panels surface their own render counts —
// visible proof that Nexus wakes only the components whose path changed, instead of re-rendering the whole tree.
export const setDebug = (value: boolean) => setControl('debug', value);

export const isDebug = () => getControl('debug');

// Subscribes a component to the debug flag so it re-renders when toggled.
export const useDebug = (): boolean => useControl('debug');

// Counts how many times the calling component has rendered. Incremented every render; the value persists across
// renders via a ref.
export const useRenderCount = (): number => {
  const count = useRef(0);
  count.current += 1;

  return count.current;
};
