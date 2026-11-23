import clsx from 'clsx';

import { chooseAudienceVariant } from '@plitzi/sdk-shared/audiences';
import { experimentNameOf, indexOfVariant, isExperimentVariant } from '@plitzi/sdk-shared/experiments';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';
import { HIDDEN_CLASS } from '@plitzi/sdk-shared/style';

import { childOfItem } from './childOfItem';
import useAudienceScope from '../../../dataSource/useAudienceScope';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { ChooseBy } from '@plitzi/sdk-shared/variants';
import type { ReactNode, RefObject } from 'react';

export type VariantsProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /**
   * How it chooses the variant a visitor sees: `chance` — an A/B test, each variant shown to its `weight`'s share of
   * the visitors, and a visitor kept on theirs when they come back — or `rules`, the first variant whose `when` the
   * visitor matches (one with no conditions is for everybody else).
   */
  chooseBy?: ChooseBy;
  /**
   * By chance, the experiment's name — `heroTest`: what keeps a visitor on their variant, what `{{ experiments.heroTest
   * }}` reads and what the results are shown under. Every element with the same name shows a visitor the same variant.
   * Left empty, it is named after the element (`pricing-test` runs `pricing_test`).
   */
  experiment?: string;
  /**
   * The variant (from 0) the builder's canvas shows while editing, so each can be edited. Its preview shows the
   * simulated visitor's. Visitors never see it decided this way.
   */
  builderVariant?: number;
};

const Variants = ({
  ref,
  className = '',
  children,
  chooseBy = 'chance',
  experiment = '',
  builderVariant = 0
}: VariantsProps) => {
  const { id, definition } = useElement();
  const items = definition.items ?? [];
  const { builder, previewMode } = useRenderSettings();
  const [assigned] = useCommonStore('runtime.sources.experiments');
  const [rules] = useCommonStore(items.map(item => `schema.flat.${item}.attributes.when` as const));
  const scope = useAudienceScope();

  let shown: number;
  if (builder && !previewMode) {
    shown = builderVariant;
  } else if (chooseBy === 'rules') {
    shown = chooseAudienceVariant(rules, scope);
  } else {
    const name = experimentNameOf({ id, attributes: { experiment } });
    const variant = name === undefined ? undefined : assigned?.[name];
    shown = isExperimentVariant(variant) ? indexOfVariant(variant) : 0;
  }

  // Found by its item, as a variant a flag switched off is not among the children. The others are not drawn at all —
  // absent, not hidden: their providers ask for nothing and their words are not in the page.
  const variant = childOfItem(children, items[shown]);

  return (
    // A visitor no variant is for (by rules, with no "everyone else") sees nothing, and it takes no room.
    <RootElement ref={ref} className={clsx('plitzi-component__variants', className, { [HIDDEN_CLASS]: !variant })}>
      {variant}
    </RootElement>
  );
};

export default withElement(Variants);

export { Variants };
