/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useImperativeHandle } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { RefObject, ReactNode, CSSProperties, MouseEvent } from 'react';

export type DropdownPopupProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
  // Custom Props
  onClick: (e: MouseEvent) => void;
  openPopup?: boolean;
  parameters?: CSSProperties;
  popupRef?: RefObject<HTMLElement | null>;
};

const DropdownPopup = ({
  ref,
  className = '',
  children,
  onClick,
  openPopup,
  parameters,
  popupRef
}: DropdownPopupProps) => {
  useImperativeHandle<HTMLElement, HTMLElement>(ref, () => (popupRef as RefObject<HTMLElement>).current, [popupRef]);

  return (
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
};

export default withElement(DropdownPopup);

export { DropdownPopup };
