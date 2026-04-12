import { useEffect, useLayoutEffect } from 'react';

// Use useLayoutEffect on the client (synchronous after DOM mutations).
// Fall back to useEffect on the server where useLayoutEffect would warn.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default useIsomorphicLayoutEffect;
