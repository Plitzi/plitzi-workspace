/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';
import useTabItems from '../useTabItems';

import type { ReactNode, RefObject } from 'react';

export type TabContainerBodyProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
};

const TabContainerBody = ({ ref, className = '', children }: TabContainerBodyProps) => {
  const items = useTabItems(children, false);

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__tab-container-body', className)}>
      {items}
    </RootElement>
  );
};

export default withElement(TabContainerBody);

export { TabContainerBody };
