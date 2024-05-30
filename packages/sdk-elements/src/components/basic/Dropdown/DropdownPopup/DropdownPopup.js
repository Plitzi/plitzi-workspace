// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../../Element/RootElement';
import withElement from '../../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   className: string;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const DropdownPopup = props => {
  const { ref, className = '', internalProps = emptyObject, children } = props;
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
