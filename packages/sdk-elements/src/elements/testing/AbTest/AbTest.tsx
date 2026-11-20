import clsx from 'clsx';

import { indexOfVariant, isExperimentName, isExperimentVariant } from '@plitzi/sdk-shared/experiments';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import { childOfItem } from '../childOfItem';

import type { ExperimentVariant } from '@plitzi/sdk-shared/experiments';
import type { ReactNode, RefObject } from 'react';

export type AbTestProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /**
   * The experiment's name — `heroTest`: what keeps a visitor on the same variant when they come back, and what
   * `{{ experiments.heroTest }}` reads. Every A/B test with the same name shows a visitor the same variant. Until it has
   * one the test runs nothing and shows variant A. Each variant's share of the visitors is its own `weight`.
   */
  experiment?: string;
  /**
   * The variant the builder's canvas shows while editing, so each can be edited. In its preview the canvas shows what
   * the simulated visitor is (the builder's Simulate visitor panel). Visitors never see it decided this way.
   */
  builderVariant?: ExperimentVariant;
};

const AbTest = ({ ref, className = '', children, experiment = '', builderVariant = 'a' }: AbTestProps) => {
  const { definition } = useElement();
  const { builder, previewMode } = useRenderSettings();
  const [assigned] = useCommonStore('runtime.sources.experiments');
  const visitorVariant = isExperimentName(experiment) ? assigned?.[experiment] : undefined;
  const editing = builder && !previewMode;
  const variant = editing ? builderVariant : isExperimentVariant(visitorVariant) ? visitorVariant : 'a';
  // The first variant is A, the second B and so on, by their place among the test's items — found by the item, as a
  // variant a flag switched off is not among the children. The others are not drawn at all — not hidden, absent: their
  // providers ask for nothing and their words are not in the page.
  const shown = childOfItem(children, (definition.items ?? [])[indexOfVariant(variant)]);

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__ab-test', className)}>
      {shown}
    </RootElement>
  );
};

export default withElement(AbTest);

export { AbTest };
