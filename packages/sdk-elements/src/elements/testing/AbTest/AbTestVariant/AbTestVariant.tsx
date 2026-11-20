import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type AbTestVariantProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /**
   * Its share of the visitors, against the other variants' weights: 0–100. 0 shows it to nobody, and the visitors who
   * were shown it are drawn again. Read by the A/B test around it, which draws the variant.
   */
  weight?: number;
};

const AbTestVariant = ({ ref, className = '', children }: AbTestVariantProps) => (
  <RootElement ref={ref} className={clsx('plitzi-component__ab-test-variant', className)}>
    {children}
  </RootElement>
);

export default withElement(AbTestVariant);

export { AbTestVariant };
