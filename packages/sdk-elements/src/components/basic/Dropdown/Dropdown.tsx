/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactElement, ReactNode, RefObject } from 'react';

type InternalPropsSubProps = {
  styleSelectors: Record<string, string>;
};

export type DropdownProps = {
  ref?: RefObject<HTMLElement>;
  internalProps: InternalPropsSTG2<InternalPropsSubProps>;
  children?: ReactNode;
  className?: string;
  popupPlacement?: 'left' | 'right' | 'top' | 'bottom';
  openPopup?: boolean;
  backgroundDisabled?: boolean;
  closeOnClickBackground?: boolean;
  closeOnClickPopup?: boolean;
  containerTopOffset?: number;
  containerLeftOffset?: number;
  disabled?: boolean;
};

const Dropdown = ({
  ref,
  internalProps,
  children,
  className = '',
  popupPlacement = 'bottom',
  openPopup = false,
  backgroundDisabled = false,
  closeOnClickBackground = true,
  closeOnClickPopup = true,
  containerTopOffset = 5,
  containerLeftOffset = 5,
  disabled = false
}: DropdownProps) => {
  const { setElementState, styleSelectors } = internalProps;
  const {
    settings: { previewMode },
    utils: { getWindow }
  } = usePlitziServiceContext();
  const popupRef = useRef<HTMLElement>(undefined);
  const backgroundContainerRef = useRef<HTMLDivElement>(null);
  const windowInstance = useMemo(() => getWindow(), [getWindow]);

  const calculatePosition = useCallback(
    (rectParent: DOMRect, rectContent: DOMRect) => {
      const w = rectContent.width;
      const h = rectContent.height;
      let top;
      let left;
      switch (popupPlacement) {
        case 'left':
          top = rectParent.top;
          if (top + h > windowInstance.innerHeight) {
            top = windowInstance.innerHeight - h - containerTopOffset;
          }

          left = rectParent.left - w - containerLeftOffset;
          if (left + w <= 0) {
            left = rectParent.left + rectParent.width + containerLeftOffset;
          }

          break;
        case 'right':
          top = rectParent.top;
          if (top + h > windowInstance.innerHeight) {
            top = windowInstance.innerHeight - h - containerTopOffset;
          }

          left = rectParent.left + rectParent.width + containerLeftOffset;
          if (left + w > windowInstance.innerWidth) {
            left = rectParent.left - w - containerLeftOffset;
          }

          break;
        case 'top':
          top = rectParent.top - h - containerTopOffset;
          if (top + h <= 0) {
            top = rectParent.top + rectParent.height + containerTopOffset;
          }

          left = rectParent.left + containerLeftOffset;
          if (left + w > windowInstance.innerWidth) {
            left = rectParent.left - w + rectParent.width - containerLeftOffset;
          }

          break;
        case 'bottom':
        default:
          top = rectParent.top + rectParent.height + containerTopOffset;
          if (top + h > windowInstance.innerHeight) {
            top = rectParent.top - h - containerTopOffset;
          }

          left = rectParent.left + containerLeftOffset;
          if (left + w > windowInstance.innerWidth) {
            left = rectParent.left - w + rectParent.width - containerLeftOffset;
          }
      }

      return { top, left };
    },
    [containerLeftOffset, containerTopOffset, windowInstance, popupPlacement]
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!previewMode || disabled) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      setElementState(state => ({ ...state, openPopup: !state.openPopup }));
    },
    [previewMode, setElementState, disabled]
  );

  const handleClickBackgroundContainer = useCallback(
    (e: MouseEvent) => {
      if (!closeOnClickBackground) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      setElementState(state => ({ ...state, openPopup: !state.openPopup }));
    },
    [closeOnClickBackground, setElementState]
  );

  const handleClickPopup = useCallback(
    (e: MouseEvent) => {
      if (!closeOnClickPopup || !previewMode) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      setElementState(state => ({ ...state, openPopup: !state.openPopup }));
    },
    [closeOnClickPopup, previewMode, setElementState]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setElementState(state => ({ ...state, openPopup: !state.openPopup }));
      }
    },
    [setElementState]
  );

  useEffect(() => {
    if (!openPopup) {
      return undefined;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPopup, handleKeyDown]);

  const parameters = useMemo(() => {
    let parameters = { top: 0, left: 0 };
    if (openPopup && ref?.current && popupRef.current) {
      const rectParent = ref.current.getBoundingClientRect();
      const rectContent = popupRef.current.getBoundingClientRect();
      parameters = calculatePosition(rectParent, rectContent);
    }

    return parameters;
  }, [openPopup, ref, popupRef, calculatePosition]);

  const { options } = useMemo(() => {
    const components: { options: ReactNode[] } = {
      options: []
    };
    Children.forEach(children, child => {
      if (!isValidElement(child)) {
        return;
      }

      const childProps = child.props as Record<string, unknown>;
      if (childProps.type === 'dropdownPopup') {
        components.options.push(
          cloneElement<Record<string, unknown>>(child as ReactElement<Record<string, unknown>>, {
            ...childProps,
            internalProps: { onClick: handleClickPopup, openPopup, parameters, popupRef }
          })
        );
      }
    });

    return components;
  }, [children, handleClickPopup, openPopup, parameters]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__dropdown', className, {
        'container--empty--skip': !previewMode && !children
      })}
      onClick={handleClick}
    >
      {options}
      {openPopup && backgroundDisabled && previewMode && (
        <div
          ref={backgroundContainerRef}
          className={classNames('plitzi-component__dropdown__background-container', styleSelectors.backgroundContainer)}
          onClick={handleClickBackgroundContainer}
        />
      )}
    </RootElement>
  );
};

export default withElement(Dropdown);

export { Dropdown };
