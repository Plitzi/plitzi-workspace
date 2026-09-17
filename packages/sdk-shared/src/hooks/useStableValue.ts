import deepEqual from '@plitzi/plitzi-ui/utils/deepEqual';
import { useRef } from 'react';

/**
 * The previous value, as long as the new one has the same content.
 *
 * For values rebuilt on every render that are then published — written to a store, handed down as a prop, compared by
 * reference by whoever reads them. A route's params come back as a new `{}` on every navigation; published as they
 * come, every element subscribed to them rendered again for a value that had not changed.
 *
 * The ref is written during render, and only ever to a value equal in content to what the render was given, so a
 * render React throws away leaves nothing observable behind.
 */
const useStableValue = <T>(value: T): T => {
  const ref = useRef(value);
  if (ref.current !== value && !deepEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
};

export default useStableValue;
