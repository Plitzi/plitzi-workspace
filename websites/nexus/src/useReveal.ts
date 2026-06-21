import { useEffect, useRef, useState } from 'react';

// Reveals an element once it scrolls into view: returns a ref to attach and a boolean that flips to true on the first
// intersection, then stops observing. Pair with the `.reveal` CSS utility for a fade/slide-in. Respects
// `prefers-reduced-motion` by revealing immediately.
const useReveal = <T extends HTMLElement = HTMLDivElement>(options?: IntersectionObserverInit) => {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);

      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px', ...options }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [options]);

  return { ref, visible };
};

export default useReveal;
