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

/**
 * The tab the page was drawn with: on the server and in a render of the browser's own, the first; hydrating, the one
 * the document shows — the page's script may have opened the tab its address names before it painted (sdk-server's
 * `tabHash.js`), and React hydrates what is there rather than putting the first back.
 */
const drawnTab = (baseId: string): number => {
  if (typeof document === 'undefined') {
    return 0;
  }

  const open = document.querySelector(`[id^="${CSS.escape(`${baseId}_tab_`)}"][aria-selected="true"]`);
  const index = open ? Number(open.id.slice(`${baseId}_tab_`.length)) : 0;

  return Number.isInteger(index) && index >= 0 ? index : 0;
};

const TabContainer = ({ ref, className = '', children }: TabContainerProps) => {
  const { id, rootId } = useElement();
  const baseId = `${rootId}_${id}`;
  const [tabSelected, setTabSelected] = useState(() => drawnTab(baseId));
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
