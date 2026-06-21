import { useEffect, useRef, useState } from 'react';

// Bumps a key whenever `value` changes (after the first render), so a keyed element can remount and replay a CSS
// pulse. Because a Leaf only re-renders when its watched path changes, every bump here is a genuine, path-scoped
// re-render — which is exactly the point the diagram makes visible.
const usePulseOnChange = (value: unknown) => {
  const [key, setKey] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      return;
    }

    setKey(k => k + 1);
  }, [value]);

  return key;
};

export default usePulseOnChange;
