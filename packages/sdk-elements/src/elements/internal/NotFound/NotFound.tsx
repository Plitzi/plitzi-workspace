/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type NotFoundProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
};

const NotFound = ({ ref, className = '' }: NotFoundProps) => {
  const {
    definition: { label }
  } = useElement();
  const {
    settings: { isHydrating, previewMode }
  } = usePlitziServiceContext();
  if (typeof window === 'undefined' || previewMode || isHydrating) {
    return undefined;
  }

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__not-found', className)}>
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
