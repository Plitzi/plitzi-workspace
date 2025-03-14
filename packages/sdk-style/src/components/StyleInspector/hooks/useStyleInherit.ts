import { use, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';

import { calculateInheriting } from '../../../StyleHelper';

import type { Element } from '@plitzi/sdk-shared';

export type UseStyleInheritProps = {
  element?: Element;
  selector?: string;
  styleSelector?: string;
};

const useStyleInherit = ({ element, selector, styleSelector }: UseStyleInheritProps) => {
  const { componentDefinitions } = use(ComponentContext);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const {
    style: { platform }
  } = use(BuilderStyleContext);

  const inheritData = useMemo(() => {
    const selectorsToSkip: string[] = [];
    if (selector && !selector.includes(':')) {
      selectorsToSkip.push(selector);
    }

    return calculateInheriting(element, flat, platform, styleSelector, componentDefinitions, selectorsToSkip);
  }, [selector, element, flat, platform, styleSelector, componentDefinitions]);

  return inheritData;
};

export default useStyleInherit;
