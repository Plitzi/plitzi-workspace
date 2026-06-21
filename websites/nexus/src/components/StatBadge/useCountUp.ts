import { useEffect, useRef, useState } from 'react';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Animates an integer from 0 to `target` over `duration` ms once `target` becomes a number. Returns the current
// frame value. Reduced-motion users jump straight to the target.
const useCountUp = (target: number | null, duration = 1100) => {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (target === null) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);

      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(easeOut(progress) * target));

      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
};

export default useCountUp;
