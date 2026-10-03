import { useEffect } from 'react';

/**
 * Outlines an element on the page — every copy of it, a list row's elements being one per row — while `id` is set:
 * the one way every tab points at what it is talking about.
 */
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
