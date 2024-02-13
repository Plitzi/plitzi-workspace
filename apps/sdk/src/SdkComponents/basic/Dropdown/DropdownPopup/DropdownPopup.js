// Packages
import React, { forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relative
import { emptyObject } from '../../../../helpers/utils';

const DropdownPopup = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject, children } = props;
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
});

DropdownPopup.propTypes = {
  internalProps: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string
};

export default withElement(DropdownPopup);

export { DropdownPopup };
