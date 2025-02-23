/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { cloneElement } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';

export type TabContainerBodyProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalProps<InternalPropsSubProps>;
  children: ReactNode;
};

type InternalPropsSubProps = {
  tabSelected?: number;
  onSelect?: Dispatch<SetStateAction<number>>;
};

const TabContainerBody = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps<InternalPropsSubProps>,
  children
}: TabContainerBodyProps) => {
  const { onSelect, tabSelected } = internalProps;

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container-body', className)}
    >
      {Array.isArray(children) &&
        children.map((child, i) =>
          cloneElement(child, { ...child.props, internalProps: { onSelect, tabSelected, tabIndex: i } })
        )}
    </RootElement>
  );
};

export default withElement(TabContainerBody);

export { TabContainerBody };
