/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { Children, cloneElement, isValidElement, useCallback, useMemo, useRef } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useDropdown from './useDropdown';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG0, InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactElement, ReactNode, RefObject } from 'react';

type InternalPropsSubProps = {
  styleSelectors: Record<string, string>;
};

export type DropdownProps = {
  ref?: RefObject<HTMLDivElement | null>;
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
  const popupRef = useRef<HTMLDivElement | null>(null);
  const backgroundContainerRef = useRef<HTMLDivElement>(null);
  const windowInstance = useMemo(() => getWindow(), [getWindow]);

  const handleClickBackgroundContainer = useCallback(
    (e: MouseEvent) => {
      if (!closeOnClickBackground) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      setElementState(state => ({ ...state, openPopup: false }));
    },
    [closeOnClickBackground, setElementState]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setElementState(state => ({ ...state, openPopup: open }));
    },
    [setElementState]
  );

  const [, , handleClick, handleClickPopup, , parameters] = useDropdown({
    ref,
    popupRef,
    open: openPopup,
    disabled: !previewMode || disabled,
    closeOnClickPopup,
    placement: popupPlacement,
    offsetX: containerLeftOffset,
    offsetY: containerTopOffset,
    myWindow: windowInstance,
    onChange: handleOpenChange
  });

  const { options, childrenParsed } = useMemo(() => {
    const components: { options: ReactNode[]; childrenParsed: ReactNode[] } = {
      options: [],
      childrenParsed: []
    };
    Children.forEach(children, (child, i) => {
      if (!isValidElement(child)) {
        return;
      }

      const childProps = child.props as { type: string; [key: string]: unknown; internalProps: InternalPropsSTG0 };
      if (childProps.type === 'dropdownPopup') {
        components.options.push(
          cloneElement<InternalPropsSTG0>(child as ReactElement<InternalPropsSTG0>, {
            ...childProps,
            internalProps: { ...childProps.internalProps, onClick: handleClickPopup, openPopup, parameters, popupRef },
            key: `${internalProps.id}-${i}`
          })
        );
      } else {
        components.childrenParsed.push(
          cloneElement<InternalPropsSTG0>(child as ReactElement<InternalPropsSTG0>, {
            ...childProps,
            key: `${internalProps.id}-${i}`
          })
        );
      }
    });

    return components;
  }, [children, handleClickPopup, internalProps.id, openPopup, parameters]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={clsx('plitzi-component__dropdown', className, {
        'container--empty--skip': !previewMode && !children
      })}
      onClick={handleClick}
    >
      {childrenParsed}
      {options}
      {openPopup && backgroundDisabled && previewMode && (
        <div
          ref={backgroundContainerRef}
          className={clsx('plitzi-component__dropdown__background-container', styleSelectors.backgroundContainer)}
          onClick={handleClickBackgroundContainer}
        />
      )}
    </RootElement>
  );
};

export default withElement(Dropdown);

export { Dropdown };
