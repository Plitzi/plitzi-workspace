import { use, useMemo } from 'react';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import calculateInheriting from '../../../helpers/calculateInheriting';

import type { Element, StyleState } from '@plitzi/sdk-shared';

export type UseStyleInheritProps = {
  element?: Element;
  componentType?: string;
  selector?: string;
  styleSelector?: string;
  styleState?: StyleState;
  styleVariant?: string;
};

const useStyleInherit = ({
  element,
  componentType,
  selector,
  styleSelector,
  styleState,
  styleVariant
}: UseStyleInheritProps) => {
  const { componentDefinitions } = use(ComponentContext);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const {
    style: { platform }
  } = use(BuilderStyleContext);

  const inheritData = useMemo(() => {
    const selectorsToSkip: string[] = [];
    const selectorsToInclude: string[] = [];
    if (selector && !styleState && !styleVariant) {
      selectorsToSkip.push(selector);
    }

    if (!element && selector && (styleState || styleVariant)) {
      selectorsToInclude.push(selector);
    }

    return calculateInheriting(
      element,
      componentType,
      flat,
      platform,
      { styleSelector, styleState, styleVariant },
      componentDefinitions.current,
      selectorsToSkip,
      selectorsToInclude
    );
  }, [selector, styleState, element, componentType, flat, platform, styleSelector, styleVariant, componentDefinitions]);

  return inheritData;
};

export default useStyleInherit;
