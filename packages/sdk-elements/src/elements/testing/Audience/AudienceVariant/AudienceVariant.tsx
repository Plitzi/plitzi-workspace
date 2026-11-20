import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import RootElement from '../../../../Element/RootElement';

import type { RuleGroup } from '@plitzi/sdk-shared/conditions';
import type { ReactNode, RefObject } from 'react';

export type AudienceVariantProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /**
   * The visitors it is for: a rule group over what a flag sees and `visitor.returning`, `visitor.language`,
   * `visitor.device`. With no conditions it is for everybody the variants before it did not take. Read by the audience
   * around it, which draws the variant.
   */
  when?: RuleGroup;
};

const AudienceVariant = ({ ref, className = '', children }: AudienceVariantProps) => (
  <RootElement ref={ref} className={clsx('plitzi-component__audience-variant', className)}>
    {children}
  </RootElement>
);

export default withElement(AudienceVariant);

export { AudienceVariant };
