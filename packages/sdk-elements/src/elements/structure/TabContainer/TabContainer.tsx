/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useState, useMemo } from 'react';

import TabContainerContext from './TabContainerContext';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type TabContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
};

const TabContainer = ({ ref, className = '', children }: TabContainerProps) => {
  const { id, rootId } = useElement();
  const [tabSelected, setTabSelected] = useState(0);
  const baseId = `${rootId}_${id}`;
  const tabContainerContextValue = useMemo(
    () => ({ baseId, tabSelected, onSelect: setTabSelected }),
    [baseId, tabSelected]
  );

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__tab-container', className)}>
      <TabContainerContext value={tabContainerContextValue}>{children}</TabContainerContext>
    </RootElement>
  );
};

export default withElement(TabContainer);

export { TabContainer };
