import { useEffect } from 'react';

// Outlines the selected element on the page, reusing the Elements tab's `devtools-element-hovered` class on `[data-id]`.
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
