import { Children, cloneElement, isValidElement, use, useMemo } from 'react';

import TabContainerContext from './TabContainerContext';

import type { ReactElement, ReactNode } from 'react';

/**
 * The tabs of a header or a body, each handed what it needs of the container around it: which tab is selected, how to
 * select one, and its own place. A header's also learn they are its, and how many there are, for their `tab` roles.
 */
const useTabItems = (children: ReactNode, isHeader: boolean): ReactNode[] => {
  const { baseId, tabSelected, onSelect } = use(TabContainerContext);

  return useMemo(() => {
    const items: ReactNode[] = [];
    const tabCount = Children.toArray(children).filter(isValidElement).length;
    Children.forEach(children, (child, i: number) => {
      if (!isValidElement(child)) {
        return;
      }

      const childProps = child.props as Record<string, unknown>;
      items.push(
        cloneElement<Record<string, unknown>>(child as ReactElement<Record<string, unknown>>, {
          ...childProps,
          internalProps: {
            ...(childProps.internalProps as Record<string, unknown>),
            ...(isHeader ? { isHeader: true, tabCount } : {}),
            baseId,
            onSelect,
            tabSelected,
            tabIndex: i
          }
        })
      );
    });

    return items;
  }, [baseId, children, isHeader, onSelect, tabSelected]);
};

export default useTabItems;
