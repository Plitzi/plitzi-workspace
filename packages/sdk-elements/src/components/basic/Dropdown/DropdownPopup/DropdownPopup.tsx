/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { RefObject, ReactNode, CSSProperties, MouseEvent } from 'react';

type InternalPropsSubProps = {
  onClick: (e: MouseEvent) => void;
  openPopup?: boolean;
  parameters?: CSSProperties;
  popupRef?: RefObject<unknown>;
};

export type DropdownPopupProps = {
  ref?: RefObject<HTMLElement>;
  internalProps?: InternalProps<InternalPropsSubProps>;
  className?: string;
  children?: ReactNode;
};

const DropdownPopup = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps<InternalPropsSubProps>,
  children
}: DropdownPopupProps) => {
  const { onClick, openPopup, parameters, popupRef } = internalProps;
  const refProxy = useMemo(
    () =>
      new Proxy(
        { current: popupRef?.current },
        {
          get(target, prop) {
            if (!target) {
              return undefined;
            }

            return target[prop];
          },
          set(target, prop, newValue) {
            target[prop] = newValue;
            // Do other process if are required like datasets
            if (popupRef) {
              popupRef.current = newValue;
            }

            ref.current = newValue;

            return true;
          }
        }
      ),
    [popupRef, ref]
  );

  return (
    <RootElement
      ref={refProxy}
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
