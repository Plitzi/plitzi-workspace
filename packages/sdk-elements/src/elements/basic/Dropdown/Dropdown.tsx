/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useMemo, useRef } from 'react';

import useElement from '@plitzi/sdk-shared/elements/hooks/useElement';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import DropdownContext from './DropdownContext';
import useDropdown from './useDropdown';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { MouseEvent, ReactNode, RefObject } from 'react';

export type DropdownProps = {
  id: string;
  ref?: RefObject<HTMLDivElement | null>;
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
  id,
  ref,
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
  const {
    setElementState,
    definition: { styleSelectors }
  } = useElement(id);
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

  const dropdownContext = useMemo(
    () => ({ popupRef, openPopup, parameters, onClick: handleClickPopup }),
    [handleClickPopup, openPopup, parameters]
  );

  return (
    <RootElement
      id={id}
      ref={ref}
      className={clsx('plitzi-component__dropdown', className, { 'container--empty--skip': !previewMode && !children })}
      onClick={handleClick}
    >
      <DropdownContext value={dropdownContext}>{children}</DropdownContext>
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
