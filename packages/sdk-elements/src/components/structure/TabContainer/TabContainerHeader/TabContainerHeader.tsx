/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { Children, cloneElement, isValidElement, useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { Dispatch, ReactElement, ReactNode, RefObject, SetStateAction } from 'react';

type InternalPropsSubProps = {
  tabSelected?: number;
  onSelect?: Dispatch<SetStateAction<number>>;
};

export type TabContainerHeaderProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalProps<InternalPropsSubProps>;
  children: ReactNode;
};

const TabContainerHeader = ({
  ref,
  className = '',
  internalProps = emptyObject as InternalProps<InternalPropsSubProps>,
  children
}: TabContainerHeaderProps) => {
  const { onSelect, tabSelected } = internalProps;

  const { childrenParsed } = useMemo(() => {
    const components: { childrenParsed: ReactNode[] } = { childrenParsed: [] };
    Children.forEach(children, (child, i: number) => {
      if (!isValidElement(child)) {
        return;
      }

      const childProps = child.props as Record<string, unknown>;
      components.childrenParsed.push(
        cloneElement<Record<string, unknown>>(child as ReactElement<Record<string, unknown>>, {
          ...childProps,
          internalProps: { isHeader: true, onSelect, tabSelected, tabIndex: i }
        })
      );
    });

    return components;
  }, [children, onSelect, tabSelected]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container-header', className)}
    >
      {childrenParsed}
    </RootElement>
  );
};

export default withElement(TabContainerHeader);

export { TabContainerHeader };
