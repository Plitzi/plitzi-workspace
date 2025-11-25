/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import get from 'lodash-es/get.js';
import { use } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type NotFoundProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps: InternalPropsSTG2;
};

const NotFound = ({ ref, className = '', internalProps }: NotFoundProps) => {
  const label = get(internalProps, 'definition.label') as string;
  const {
    settings: { previewMode },
    contexts: { ComponentContext }
  } = usePlitziServiceContext();
  const { isHydrating } = use(ComponentContext);
  if ((typeof window === 'undefined' && previewMode) || isHydrating) {
    return undefined;
  }

  return (
    <RootElement ref={ref} internalProps={internalProps} className={clsx('plitzi-component__not-found', className)}>
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
