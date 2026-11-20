import clsx from 'clsx';
import { Children, isValidElement } from 'react';

import { isExperimentName, isExperimentVariant } from '@plitzi/sdk-shared/experiments';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { ExperimentVariant } from '@plitzi/sdk-shared/experiments';
import type { ReactNode, RefObject } from 'react';

export type AbTestProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /**
   * The experiment's name — `heroTest`: what keeps a visitor on the same side when they come back, and what
   * `{{ experiments.heroTest }}` reads. Every A/B test with the same name shows a visitor the same side. Until it has one
   * the test runs nothing and shows variant A.
   */
  experiment?: string;
  /** The share of visitors, 0–100, who see variant B; the rest see A. 0 or 100 ends the experiment for everybody. */
  split?: number;
  /** The variant the builder's canvas shows, so either can be edited. Visitors never see it decided this way. */
  builderVariant?: ExperimentVariant;
};

const AbTest = ({ ref, className = '', children, experiment = '', builderVariant = 'a' }: AbTestProps) => {
  const { builder } = useRenderSettings();
  const [assigned] = useCommonStore('runtime.sources.experiments');
  const visitorVariant = isExperimentName(experiment) ? assigned?.[experiment] : undefined;
  const variant = builder ? builderVariant : isExperimentVariant(visitorVariant) ? visitorVariant : 'a';
  // The first variant is A and the second B; the other is not drawn at all — not hidden, absent: its providers ask for
  // nothing and its words are not in the page.
  const shown = Children.toArray(children).filter(isValidElement)[variant === 'b' ? 1 : 0];

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__ab-test', className)}>
      {shown}
    </RootElement>
  );
};

export default withElement(AbTest);

export { AbTest };
