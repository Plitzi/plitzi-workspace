/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';
import DropdownContext from '../DropdownContext';

import type { RefObject, ReactNode } from 'react';

export type DropdownPopupProps = {
  ref?: RefObject<HTMLDivElement | null>;
  className?: string;
  children?: ReactNode;
};

const DropdownPopup = ({ ref, className = '', children }: DropdownPopupProps) => {
  const { popupRef, openPopup, parameters, onClick, layer } = use(DropdownContext);
  useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(ref, () => popupRef.current ?? null, [popupRef]);

  const popup = (
    <RootElement
      ref={popupRef}
      className={clsx('plitzi-component__dropdown-popup', className, {
        'popup-container--no-visible': !openPopup || !parameters
      })}
      style={parameters}
      onClick={onClick}
    >
      {children}
    </RootElement>
  );

  return layer ? createPortal(popup, layer) : popup;
};

export default withElement(DropdownPopup);

export { DropdownPopup };
