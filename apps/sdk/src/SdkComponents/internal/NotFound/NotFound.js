// Packages
import React from 'react';
import classNames from 'classnames';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 * }} props
 * @returns {React.ReactElement}
 */
const NotFound = props => {
  const { ref, className = '', internalProps = emptyObject } = props;
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
};

export default withElement(NotFound);

export { NotFound };
