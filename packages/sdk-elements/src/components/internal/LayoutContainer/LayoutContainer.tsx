/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { useCallback, useEffect } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type LayoutContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps: InternalPropsSTG2;
  children?: ReactNode;
  subType?: 'div' | 'header' | 'footer' | 'nav' | 'main' | 'section' | 'article' | 'aside' | 'address' | 'figure';
};

const LayoutContainer = ({ ref, className = '', internalProps, children, subType = 'div' }: LayoutContainerProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  const updateMask = useCallback((elementDOM?: HTMLElement, childElementDOM?: Element | null) => {
    if (!elementDOM || !childElementDOM) {
      return;
    }

    const parent = elementDOM;
    const child = childElementDOM;
    const childRect = child.getBoundingClientRect();

    const offset = 0;
    const top = childRect.top - offset;
    const left = childRect.left - offset;
    const right = left + childRect.width + offset * 2;
    const bottom = top + childRect.height + offset * 2;

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
    const plitziElementLayout = internalProps.plitziElementLayout;
    if (!plitziElementLayout || !ref?.current || previewMode) {
      return;
    }

    updateMask(ref.current, ref.current.querySelector('.plitzi-component--layout-body'));
  }, [internalProps.plitziElementLayout, previewMode, ref, updateMask]);

  return (
    <RootElement
      ref={ref}
      tag={subType}
      internalProps={internalProps}
      className={classNames('plitzi-component__layout-container', className)}
    >
      {children}
    </RootElement>
  );
};

export default withElement(LayoutContainer);

export { LayoutContainer };
