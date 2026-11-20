import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type AbTestVariantProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
};

const AbTestVariant = ({ ref, className = '', children }: AbTestVariantProps) => (
  <RootElement ref={ref} className={clsx('plitzi-component__ab-test-variant', className)}>
    {children}
  </RootElement>
);

export default withElement(AbTestVariant);

export { AbTestVariant };
