/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { Children, cloneElement, isValidElement, useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { Dispatch, ReactElement, ReactNode, RefObject, SetStateAction } from 'react';

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
          internalProps: { onSelect, tabSelected, tabIndex: i }
        })
      );
    });

    return components;
  }, [children, onSelect, tabSelected]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__tab-container-body', className)}
    >
      {childrenParsed}
    </RootElement>
  );
};

export default withElement(TabContainerBody);

export { TabContainerBody };
