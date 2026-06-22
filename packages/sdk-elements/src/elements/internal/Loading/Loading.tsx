/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type LoadingProps = {
  id: string;
  ref?: RefObject<HTMLElement>;
  className?: string;
};

const Loading = ({ id, ref, className = '' }: LoadingProps) => {
  const {
    definition: { label }
  } = useElement(id);

  return (
    <RootElement id={id} ref={ref} className={clsx('plitzi-component__loading', className)}>
      <span>
        <b>{label}</b> Loading...
      </span>
    </RootElement>
  );
};

export default withElement(Loading);

export { Loading };
