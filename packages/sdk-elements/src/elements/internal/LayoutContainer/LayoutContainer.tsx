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

/**
 * The slot of THIS layout. A layout nested inside another carries a slot of its own further down, and the outer one
 * must not cut its hole there.
 */
const ownBody = (layout: HTMLElement): Element | null =>
  [...layout.querySelectorAll('.plitzi-component--layout-body')].find(
    body => body.parentElement?.closest('.plitzi-component__layout-container') === layout
  ) ?? null;

const LayoutContainer = ({ ref, className = '', children, subType = 'div' }: LayoutContainerProps) => {
  const { plitziElementLayout } = useElement();
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  const updateMask = useCallback((parent?: HTMLElement, child?: Element | null) => {
    if (!parent || !child) {
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
    if (!plitziElementLayout || !ref?.current || previewMode) {
      return;
    }

    const handleResize = throttle(() => {
      const parent = ref.current;
      updateMask(parent, ownBody(parent));
    }, 150);

    const observer = new ResizeObserver(handleResize);
    observer.observe(ref.current);

    const child = ownBody(ref.current);
    if (child) {
      observer.observe(child);
    }

    return () => {
      handleResize.cancel();
      observer.disconnect();
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
