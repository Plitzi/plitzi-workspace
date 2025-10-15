/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import get from 'lodash/get.js';

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
    settings: { renderMode, previewMode }
  } = usePlitziServiceContext();

  if (renderMode === 'ssr' && previewMode) {
    return undefined;
  }

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
