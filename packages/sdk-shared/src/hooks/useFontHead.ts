import { useEffect } from 'react';

import type { FontHead } from '../types/StyleTypes';

/**
 * Puts a resolved font manifest in the DOCUMENT's head — never in a shadow root, never in the style cache.
 *
 * Two facts force it there. A `@font-face` inside a shadow tree is ignored by the browser, so a widget that
 * declared its faces where its markup lives would render every one of them in a fallback. And a `font-family` in
 * the compiled stylesheet names a face without asking for it: nothing in the SDK ever requested one, which is why
 * a space that chose Lato in the builder was published in Arial.
 *
 * A server-rendered page already carries all of this, written by the SSR template before the first paint, so
 * everything here recognises what is already in the document rather than adding a second copy. The other caller is
 * the editor itself, which loads the space's families so a font picker can draw each name in its own typeface.
 */
const FACES_MARKER = 'data-plitzi-fonts';

const useFontHead = (head: FontHead): void => {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const { head: documentHead } = document;
    const added: Element[] = [];

    head.preconnect.forEach(origin => {
      if (documentHead.querySelector(`link[rel="preconnect"][href="${CSS.escape(origin.href)}"]`)) {
        return;
      }

      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin.href;
      if (origin.crossorigin) {
        link.crossOrigin = '';
      }

      documentHead.appendChild(link);
      added.push(link);
    });

    head.links.forEach(item => {
      if (documentHead.querySelector(`link[rel="${item.rel}"][href="${CSS.escape(item.href)}"]`)) {
        return;
      }

      const link = document.createElement('link');
      link.rel = item.rel;
      link.href = item.href;
      if (item.as) {
        link.as = item.as;
      }

      if (item.type) {
        link.type = item.type;
      }

      if (item.crossorigin) {
        link.crossOrigin = '';
      }

      documentHead.appendChild(link);
      added.push(link);
    });

    if (head.faces && !documentHead.querySelector(`style[${FACES_MARKER}]`)) {
      const style = document.createElement('style');
      style.setAttribute(FACES_MARKER, '');
      style.textContent = head.faces;
      documentHead.appendChild(style);
      added.push(style);
    }

    return () => added.forEach(node => node.remove());
  }, [head]);
};

export default useFontHead;
