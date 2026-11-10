import clsx from 'clsx';

import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useRenderSettings } from '@plitzi/sdk-shared/store';

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
    settings: { previewMode }
  } = usePlitzi();
  const { isHydrating } = useRenderSettings();
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
