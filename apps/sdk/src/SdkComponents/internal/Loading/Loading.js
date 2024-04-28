// Packages
import React from 'react';
import classNames from 'classnames';

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
const Loading = props => {
  const { ref, className = '', internalProps = emptyObject } = props;
  const {
    definition: { label }
  } = internalProps;

  return (
    <RootElement ref={ref} internalProps={internalProps} className={classNames('plitzi-component__loading', className)}>
      <span>
        <b>{label}</b> Loading...
      </span>
    </RootElement>
  );
};

export default withElement(Loading);
