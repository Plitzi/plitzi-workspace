/* eslint-disable react-refresh/only-export-components */

import { throttle } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useEffect } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type LayoutContainerProps = {
  ref?: RefObject<HTMLElement>;
  /**
   * The layout this one is shown inside, and the container in it that takes this one — the same pair a page names.
   * Read by the page that renders the chain (`useLayoutChain`), not here.
   */
  layout?: string;
  layoutContainer?: string;
  className?: string;
  children?: ReactNode;
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
};

const LAYOUT_SELECTOR = '.plitzi-component__layout-container';
const BODY_SELECTOR = '.plitzi-component--layout-body';

/**
 * Where the page is: the slot no other slot sits inside.
 *
 * With shells nested, the outer shell's slot holds the inner shell — its header and tabs are chrome too — so the hole
 * belongs on the innermost slot, whichever shell it is in.
 */
const pageBody = (layout: HTMLElement): Element | null =>
  [...layout.querySelectorAll(BODY_SELECTOR)].find(body => !body.querySelector(BODY_SELECTOR)) ?? null;

const LayoutContainer = ({ ref, className = '', children, subType = 'div' }: LayoutContainerProps) => {
  const { plitziElementLayout } = useElement();
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  const updateMask = useCallback((parent?: HTMLElement, child?: Element | null) => {
    if (!parent) {
      return;
    }

    // No body, no hole: everything the shell shows is chrome.
    if (!child) {
      parent.style.removeProperty('--child-clip');

      return;
    }

    // `clip-path` is drawn in the layout's own box, and both rects are the viewport's: a layout nested inside another
    // sits away from the origin, and the canvas zoom scales both. Measured against the parent and unscaled, the hole
    // lands on the body wherever the layout is.
    const parentRect = parent.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    const scale = parent.offsetWidth > 0 ? parentRect.width / parent.offsetWidth : 1;
    const top = (childRect.top - parentRect.top) / scale;
    const left = (childRect.left - parentRect.left) / scale;
    const right = left + childRect.width / scale;
    const bottom = top + childRect.height / scale;

    const clip = `
      polygon(
        evenodd,
        /* outer rect */
        0 0, 100% 0, 100% 100%, 0% 100%, 0 0,
        /* inner rect */ 
        ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px
      )`;

    parent.style.setProperty('--child-clip', clip);
  }, []);

  useEffect(() => {
    const layout = ref?.current;
    // Only the outermost shell masks; see `pageBody`.
    if (!plitziElementLayout || !layout || previewMode || layout.parentElement?.closest(LAYOUT_SELECTOR)) {
      return;
    }

    let observed: Element | null = null;
    const handleChange = throttle(() => {
      const body = pageBody(layout);
      if (body !== observed) {
        if (observed) {
          resizeObserver.unobserve(observed);
        }

        if (body) {
          resizeObserver.observe(body);
        }

        observed = body;
      }

      updateMask(layout, body);
    }, 50);

    // A size change is not the only thing that moves the hole: the body mounts after the shell, a nested shell's
    // header grows when its data arrives, and a scrolling slot carries the page away without resizing anything.
    const resizeObserver = new ResizeObserver(handleChange);
    resizeObserver.observe(layout);
    const mutationObserver = new MutationObserver(handleChange);
    mutationObserver.observe(layout, { childList: true, subtree: true });
    layout.addEventListener('scroll', handleChange, true);
    handleChange();

    return () => {
      handleChange.cancel();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      layout.removeEventListener('scroll', handleChange, true);
    };
  }, [plitziElementLayout, previewMode, ref, updateMask]);

  return (
    <RootElement ref={ref} tag={subType} className={clsx('plitzi-component__layout-container', className)}>
      {children}
    </RootElement>
  );
};

export default withElement(LayoutContainer);

export { LayoutContainer };
