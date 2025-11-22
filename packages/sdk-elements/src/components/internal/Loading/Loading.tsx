/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type LoadingProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps: InternalPropsSTG2;
};

const Loading = ({ ref, className = '', internalProps }: LoadingProps) => {
  const {
    definition: { label }
  } = internalProps;

  return (
    <RootElement ref={ref} internalProps={internalProps} className={clsx('plitzi-component__loading', className)}>
      <span>
        <b>{label}</b> Loading...
      </span>
    </RootElement>
  );
};

export default withElement(Loading);

export { Loading };
