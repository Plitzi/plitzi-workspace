/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import React, { useState, cloneElement } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type TabContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps?: InternalProps;
  children?: ReactNode;
};

const TabContainer = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps,
  children
}: TabContainerProps) => {
  const [tabSelected, setTabSelected] = useState(0);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container', className)}
    >
      {Array.isArray(children) &&
        children.map(child =>
          cloneElement(child, {
            ...child.props,
            internalProps: { ...child.props.internalProps, onSelect: setTabSelected, tabSelected }
          })
        )}
    </RootElement>
  );
};

export default withElement(TabContainer);

export { TabContainer };
