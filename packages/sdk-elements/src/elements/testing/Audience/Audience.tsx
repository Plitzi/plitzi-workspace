import clsx from 'clsx';

import { chooseAudienceVariant } from '@plitzi/sdk-shared/audiences';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';
import { HIDDEN_CLASS } from '@plitzi/sdk-shared/style';

import useAudienceScope from '../../../dataSource/useAudienceScope';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import { childOfItem } from '../childOfItem';

import type { ReactNode, RefObject } from 'react';

export type AudienceProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  children?: ReactNode;
  /**
   * The variant the builder's canvas shows while editing, by its place from 0, so each can be edited. In its preview
   * the canvas shows the one the simulated visitor matches. Never a visitor's.
   */
  builderVariant?: number;
};

const Audience = ({ ref, className = '', children, builderVariant = 0 }: AudienceProps) => {
  const { definition } = useElement();
  const items = definition.items ?? [];
  const { builder, previewMode } = useRenderSettings();
  const [rules] = useCommonStore(items.map(id => `schema.flat.${id}.attributes.when` as const));
  const scope = useAudienceScope();
  const shown = builder && !previewMode ? builderVariant : chooseAudienceVariant(rules, scope);
  // The variant shown, found by the item it was drawn for: the others are not drawn at all — their providers ask for
  // nothing and their words are not in the page.
  const variant = childOfItem(children, items[shown]);

  return (
    // A visitor no variant is for (an audience with no "everyone else") sees nothing, and it takes no room.
    <RootElement ref={ref} className={clsx('plitzi-component__audience', className, { [HIDDEN_CLASS]: !variant })}>
      {variant}
    </RootElement>
  );
};

export default withElement(Audience);

export { Audience };
