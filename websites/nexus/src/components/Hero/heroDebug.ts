import { useEffect, useReducer, useRef } from 'react';

// A global debug flag. When on, interactive panels surface their own render counts — visible proof that Nexus wakes
// only the components whose path changed, instead of re-rendering the whole tree.
let debug = false;
const listeners = new Set<() => void>();

export const setDebug = (value: boolean) => {
  debug = value;
  listeners.forEach(listener => listener());
};

export const isDebug = () => debug;

// Subscribes a component to the debug flag so it re-renders when toggled.
export const useDebug = (): boolean => {
  const [, force] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    listeners.add(force);

    return () => {
      listeners.delete(force);
    };
  }, []);

  return debug;
};

// Counts how many times the calling component has rendered. Incremented every render; the value persists across
// renders via a ref.
export const useRenderCount = (): number => {
  const count = useRef(0);
  count.current += 1;

  return count.current;
};
