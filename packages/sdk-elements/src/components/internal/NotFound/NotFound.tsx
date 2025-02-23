/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import get from 'lodash/get';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type NotFoundProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps?: InternalProps;
};

const NotFound = ({ ref, className = '', internalProps = emptyObject as InternalProps }: NotFoundProps) => {
  const label = get(internalProps, 'definition.label') as string;

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
