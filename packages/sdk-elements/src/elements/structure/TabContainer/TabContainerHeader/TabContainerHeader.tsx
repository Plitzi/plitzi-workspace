/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';
import useTabItems from '../useTabItems';

import type { ReactNode, RefObject } from 'react';

export type TabContainerHeaderProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
};

const TabContainerHeader = ({ ref, className = '', children }: TabContainerHeaderProps) => {
  const items = useTabItems(children, true);

  return (
    <RootElement ref={ref} role="tablist" className={clsx('plitzi-component__tab-container-header', className)}>
      {items}
    </RootElement>
  );
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
