import { useEffect } from 'react';

// Outlines the selected element on the page while it stays selected, reusing the same `devtools-element-hovered` class
// the Elements tab applies to `[data-id]` nodes — so picking a frame in the flamegraph/ranked list points at the real
// element on the canvas.
const useHighlightElement = (id: string | undefined): void => {
  useEffect(() => {
    if (typeof document === 'undefined' || !id) {
      return undefined;
    }

    const elements = document.querySelectorAll(`[data-id="${id}"]`);
    elements.forEach(element => element.classList.add('devtools-element-hovered'));

    return () => elements.forEach(element => element.classList.remove('devtools-element-hovered'));
  }, [id]);
};

export default useHighlightElement;
