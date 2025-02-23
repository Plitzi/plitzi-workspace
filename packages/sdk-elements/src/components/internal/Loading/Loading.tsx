/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type LoadingProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps?: InternalProps;
};

const Loading = ({ ref, className = '', internalProps = emptyObject as InternalProps }: LoadingProps) => {
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

export { Loading };
