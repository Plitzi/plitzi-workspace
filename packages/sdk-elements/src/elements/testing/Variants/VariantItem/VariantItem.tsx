import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { RuleGroup } from '@plitzi/sdk-shared/conditions';
import type { ReactNode, RefObject } from 'react';

export type VariantItemProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /**
   * Chosen by chance, its share of the visitors against the other variants' weights: 0–100. 0 shows it to nobody, and
   * the visitors who were shown it are drawn again.
   */
  weight?: number;
  /** Chosen by rules, the visitors it is for: a rule group. With no conditions, everybody the variants before it left. */
  when?: RuleGroup;
};

const VariantItem = ({ ref, className = '', children }: VariantItemProps) => (
  <RootElement ref={ref} className={clsx('plitzi-component__variant-item', className)}>
    {children}
  </RootElement>
);

export default withElement(VariantItem);

export { VariantItem };
