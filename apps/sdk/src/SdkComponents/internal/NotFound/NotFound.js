// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

const NotFound = forwardRef((props, ref) => {
  const { className = '', internalProps = emptyObject } = props;
  const label = get(internalProps, 'definition.label');

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__not-found', className)}
    >
      <span>
        {label && (
          <>
            Component <b>{label}</b> Not Found
          </>
        )}
        {!label && 'Component Not Found'}
      </span>
    </RootElement>
  );
});

NotFound.propTypes = {
  internalProps: PropTypes.object,
  className: PropTypes.string
};

export default withElement(NotFound);

export { NotFound };
