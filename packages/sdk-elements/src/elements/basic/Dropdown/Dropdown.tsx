/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { spaceRootOf } from '@plitzi/sdk-shared/helpers/spaceRoot';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';

import DropdownContext from './DropdownContext';
import useDropdown from './useDropdown';
import useDropdownTrigger from './useDropdownTrigger';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { MouseEvent, ReactNode, RefObject } from 'react';

export type DropdownProps = {
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
  ref: refProp,
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
  } = useElement();
  const {
    settings: { previewMode },
    utils: { getWindow }
  } = usePlitzi();
  // Its own when nothing hands it one (rendered without `withElement`): the trigger and the space's root are found from it.
  const ownRef = useRef<HTMLDivElement | null>(null);
  const ref = refProp ?? ownRef;
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
    // With no background layer to catch it, a click outside the menu is caught at the window instead — which is what
    // `closeOnClickBackground` always promised and, without the layer, never did.
    closeOnClickOutside: closeOnClickBackground && !backgroundDisabled,
    placement: popupPlacement,
    offsetX: containerLeftOffset,
    offsetY: containerTopOffset,
    myWindow: windowInstance,
    onChange: handleOpenChange
  });

  /**
   * Where the open popup and its backdrop are drawn: the space's root, from the first time the menu opens. Drawn
   * inside the dropdown, an ancestor with a `transform` — a card lifting on hover — became their containing block, so
   * `position: fixed` was measured from the card rather than the window, and one with `overflow: hidden` cut them off:
   * the menu opened and nobody saw it. Moved once and kept there, so the popup stays one node for the rest of the visit
   * and the focus a keyboard put in it can be given back. Not on the server, where nothing is open, nor in the builder,
   * where the dropdown is an element edited in place.
   */
  const [spaceRoot, setSpaceRoot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (openPopup && previewMode && !spaceRoot) {
      setSpaceRoot(spaceRootOf(ref.current));
    }
  }, [openPopup, previewMode, spaceRoot, ref]);
  const layer = previewMode ? spaceRoot : null;

  const noteClick = useDropdownTrigger({
    rootRef: ref,
    popupRef,
    open: openPopup,
    positioned: Boolean(parameters),
    enabled: Boolean(previewMode) && !disabled
  });

  const handleClickTrigger = useCallback(
    (e: MouseEvent) => {
      noteClick(e);
      handleClick(e);
    },
    [noteClick, handleClick]
  );

  const dropdownContext = useMemo(
    () => ({ popupRef, openPopup, parameters, onClick: handleClickPopup, layer }),
    [handleClickPopup, openPopup, parameters, layer]
  );
  const background = openPopup && backgroundDisabled && previewMode && (
    <div
      ref={backgroundContainerRef}
      className={clsx('plitzi-component__dropdown__background-container', styleSelectors.backgroundContainer)}
      onClick={handleClickBackgroundContainer}
    />
  );

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__dropdown', className, { 'container--empty--skip': !previewMode && !children })}
      onClick={handleClickTrigger}
    >
      <DropdownContext value={dropdownContext}>{children}</DropdownContext>
      {background && layer ? createPortal(background, layer) : background}
    </RootElement>
  );
};

export default withElement(Dropdown);

export { Dropdown };
