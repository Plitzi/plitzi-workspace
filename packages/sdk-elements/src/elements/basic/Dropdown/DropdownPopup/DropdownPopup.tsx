/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use, useImperativeHandle } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';
import DropdownContext from '../DropdownContext';

import type { RefObject, ReactNode } from 'react';

export type DropdownPopupProps = {
  id: string;
  ref?: RefObject<HTMLDivElement | null>;
  className?: string;
  children?: ReactNode;
};

const DropdownPopup = ({ id, ref, className = '', children }: DropdownPopupProps) => {
  const { popupRef, openPopup, parameters, onClick } = use(DropdownContext);
  useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(ref, () => popupRef.current ?? null, [popupRef]);

  return (
    <RootElement
      id={id}
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
};

export default withElement(DropdownPopup);

export { DropdownPopup };
