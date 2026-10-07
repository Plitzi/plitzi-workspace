/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback } from 'react';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { Dispatch, KeyboardEvent, RefObject, SetStateAction, ReactNode } from 'react';

export type TabContainerItemProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
  // Custom Props
  baseId?: string;
  tabSelected?: number;
  /** The item's position among its siblings — not the HTML attribute, which the tabs set themselves. */
  tabIndex?: number;
  /** How many tabs the header holds, so the arrow keys can go round them. */
  tabCount?: number;
  isHeader?: boolean;
  onSelect?: Dispatch<SetStateAction<number>>;
};

/** Where each key sends the focus in a row of tabs, the way every tab list on the web does. */
const targetOf = (key: string, position: number, count: number): number | undefined => {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (position + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (position - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
};

const TabContainerItem = ({
  className = '',
  children,
  ref,
  baseId = '',
  tabSelected,
  tabIndex: position = 0,
  tabCount = 0,
  isHeader,
  onSelect
}: TabContainerItemProps) => {
  const selected = tabSelected === position;
  const tabId = `${baseId}_tab_${position}`;
  const panelId = `${baseId}_panel_${position}`;

  const handleClick = useCallback(() => {
    if (!isHeader || selected) {
      return;
    }

    onSelect?.(position);
  }, [isHeader, selected, position, onSelect]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(position);

        return;
      }

      const target = targetOf(event.key, position, tabCount);
      if (target === undefined || tabCount === 0) {
        return;
      }

      event.preventDefault();
      onSelect?.(target);
      event.currentTarget.ownerDocument.getElementById(`${baseId}_tab_${target}`)?.focus();
    },
    [baseId, position, tabCount, onSelect]
  );

  const semantics = isHeader
    ? {
        id: tabId,
        role: 'tab',
        'aria-selected': selected,
        'aria-controls': panelId,
        tabIndex: selected ? 0 : -1,
        onKeyDown: handleKeyDown
      }
    : // A panel not on show is `hidden`: out of the reading order and the find-in-page, and what keeps it out of the
      // `current` state, which selects the panel on show (`[role="tabpanel"]:not([hidden])`)
      { id: panelId, role: 'tabpanel', 'aria-labelledby': tabId, tabIndex: 0, hidden: !selected };

  return (
    <RootElement
      ref={ref}
      onClick={handleClick}
      className={clsx('plitzi-component__tab-container-item', className, {
        active: selected
      })}
      {...(baseId ? semantics : {})}
    >
      {children}
    </RootElement>
  );
};

export default withElement(TabContainerItem);

export { TabContainerItem };
