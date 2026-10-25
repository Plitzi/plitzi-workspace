/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { spaceRootOf } from '@plitzi/sdk-shared/helpers';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';

import declaration from './declaration';
import DropdownContext from './DropdownContext';
import useDropdown from './useDropdown';
import useDropdownTrigger from './useDropdownTrigger';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionCallback } from '@plitzi/sdk-shared';
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
  /**
   * How wide the popup is: as its content (`content`), or at least as wide as its trigger (`trigger`) — a select's list.
   * A width in % on the popup's class reads the window's, as it is drawn at the space's root (a run's people picker).
   */
  popupWidth?: 'content' | 'trigger';
  disabled?: boolean;
};

/** Its state with the popup open or closed, the rest kept: what every way of opening and closing it writes. */
export const withOpen =
  (open: boolean) =>
  <S extends Record<string, unknown>>(state: S): S => ({ ...state, openPopup: open });

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
  popupWidth = 'content',
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
      setElementState(withOpen(false));
    },
    [closeOnClickBackground, setElementState]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setElementState(withOpen(open));
    },
    [setElementState]
  );

  const [, , handleClick, handleClickPopup, triggerRect, position] = useDropdown({
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

  const parameters = useMemo(
    () =>
      position && popupWidth === 'trigger' && triggerRect ? { ...position, minWidth: triggerRect.width } : position,
    [position, popupWidth, triggerRect]
  );

  // Opened and closed by a step, as a modal is — closing on a pick needed `updateElement` on `openPopup`.
  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      openDropdown: { ...declaration.callbacks.openDropdown, callback: () => handleOpenChange(true) },
      closeDropdown: { ...declaration.callbacks.closeDropdown, callback: () => handleOpenChange(false) },
      toggleDropdown: { ...declaration.callbacks.toggleDropdown, callback: () => handleOpenChange(!openPopup) }
    }),
    [handleOpenChange, openPopup]
  );

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
      interactionCallbacks={interactionCallbacks}
    >
      <DropdownContext value={dropdownContext}>{children}</DropdownContext>
      {background && layer ? createPortal(background, layer) : background}
    </RootElement>
  );
};

export default withElement(Dropdown);

export { Dropdown };
