/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { useImperativeHandle } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject, ReactNode, CSSProperties, MouseEvent } from 'react';

type InternalPropsSubProps = {
  onClick: (e: MouseEvent) => void;
  openPopup?: boolean;
  parameters?: CSSProperties;
  popupRef?: RefObject<HTMLElement | null>;
};

export type DropdownPopupProps = {
  ref?: RefObject<HTMLElement | null>;
  internalProps: InternalPropsSTG2<InternalPropsSubProps>;
  className?: string;
  children?: ReactNode;
};

const DropdownPopup = ({ ref, className = '', internalProps, children }: DropdownPopupProps) => {
  const { onClick, openPopup, parameters, popupRef } = internalProps;
  useImperativeHandle<HTMLElement, HTMLElement>(ref, () => (popupRef as RefObject<HTMLElement>).current, [popupRef]);

  return (
    <RootElement
      ref={popupRef}
      internalProps={internalProps}
      className={classNames('plitzi-component__dropdown-popup', className, {
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
